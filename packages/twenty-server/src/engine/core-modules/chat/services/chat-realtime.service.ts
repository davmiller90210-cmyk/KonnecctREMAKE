import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import IORedis from 'ioredis';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';

export type ChatRealtimeEvent =
  | {
      type: 'message-created';
      messageId: string;
      createdAt: string;
    }
  | {
      type: 'typing';
      userWorkspaceId: string;
      active: boolean;
      nickname?: string;
    }
  | {
      type: 'read-updated';
      userWorkspaceId: string;
      lastReadAt: string;
    }
  | {
      type: 'reactions-updated';
    }
  | {
      type: 'pins-updated';
    };

/** Per-user inbox on Redis (badge / notification list refresh). */
export type ChatInboxRealtimeEvent = {
  type: 'notification-updated';
};

const SUBSCRIBER_RECONNECT_DEBOUNCE_MS = 400;

@Injectable()
export class ChatRealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatRealtimeService.name);
  private subscriber: IORedis | null = null;
  private subscriberReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly localListeners = new Map<
    string,
    Set<(event: ChatRealtimeEvent) => void>
  >();
  private readonly inboxListeners = new Map<
    string,
    Set<(event: ChatInboxRealtimeEvent) => void>
  >();
  private readonly redisSubscriptionRefCount = new Map<string, number>();

  constructor(private readonly redisClientService: RedisClientService) {}

  private convKey(conversationKind: 'channel' | 'dm', conversationId: string) {
    return `${conversationKind}:${conversationId}`;
  }

  private redisChannel(
    conversationKind: 'channel' | 'dm',
    conversationId: string,
  ) {
    return `konnecct:native-chat:${conversationKind}:${conversationId}`;
  }

  private inboxLocalKey(workspaceId: string, userWorkspaceId: string) {
    return `inbox|${workspaceId}|${userWorkspaceId}`;
  }

  private redisInboxChannel(workspaceId: string, userWorkspaceId: string) {
    return `konnecct:native-chat:inbox|${workspaceId}|${userWorkspaceId}`;
  }

  private parseRedisChannel(channel: string): string | null {
    const prefix = 'konnecct:native-chat:';

    if (!channel.startsWith(prefix)) {
      return null;
    }

    const rest = channel.slice(prefix.length);

    if (rest.startsWith('inbox|')) {
      return null;
    }

    return rest;
  }

  private handleSubscriberMessage(channel: string, message: string): void {
    const inboxPrefix = 'konnecct:native-chat:inbox|';

    if (channel.startsWith(inboxPrefix)) {
      const rest = channel.slice(inboxPrefix.length);
      const pipeAt = rest.indexOf('|');

      if (pipeAt < 0) {
        return;
      }

      const workspaceId = rest.slice(0, pipeAt);
      const userWorkspaceId = rest.slice(pipeAt + 1);
      const inboxKey = this.inboxLocalKey(workspaceId, userWorkspaceId);

      try {
        const event = JSON.parse(message) as ChatInboxRealtimeEvent;

        this.notifyInboxLocal(inboxKey, event);
      } catch {
        this.logger.warn(`Invalid chat inbox payload on ${channel}`);
      }

      return;
    }

    const convKey = this.parseRedisChannel(channel);

    if (!convKey) {
      return;
    }

    try {
      const event = JSON.parse(message) as ChatRealtimeEvent;

      this.notifyLocal(convKey, event);
    } catch {
      this.logger.warn(`Invalid chat realtime payload on ${channel}`);
    }
  }

  private destroySubscriber(): void {
    if (this.subscriber) {
      this.subscriber.removeAllListeners();
      void this.subscriber.quit().catch(() => {});
      this.subscriber = null;
    }
  }

  private ensureSubscriber(): IORedis {
    if (this.subscriber) {
      return this.subscriber;
    }

    const sub = this.redisClientService.getClient().duplicate();

    sub.on('message', (channel, message) => {
      this.handleSubscriberMessage(channel, message);
    });

    sub.on('error', (error: Error) => {
      this.logger.error(
        `Chat Redis subscriber error: ${error.message}`,
        error.stack,
      );
      this.destroySubscriber();
      this.scheduleSubscriberReconnect();
    });

    sub.on('end', () => {
      this.logger.warn('Chat Redis subscriber connection ended');
      this.destroySubscriber();
      this.scheduleSubscriberReconnect();
    });

    this.subscriber = sub;

    return sub;
  }

  private async resubscribeActiveChannels(sub: IORedis): Promise<void> {
    for (const [redisCh, count] of this.redisSubscriptionRefCount.entries()) {
      if (count > 0) {
        try {
          await sub.subscribe(redisCh);
        } catch (error: unknown) {
          this.logger.error(
            `Redis resubscribe failed for ${redisCh}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }
  }

  private scheduleSubscriberReconnect(): void {
    if (this.subscriberReconnectTimer) {
      return;
    }

    this.logger.warn('Chat Redis subscriber reconnect scheduled');

    this.subscriberReconnectTimer = setTimeout(() => {
      this.subscriberReconnectTimer = null;
      void (async () => {
        const sub = this.ensureSubscriber();

        await this.resubscribeActiveChannels(sub);
      })();
    }, SUBSCRIBER_RECONNECT_DEBOUNCE_MS);
  }

  subscribe(
    conversationKind: 'channel' | 'dm',
    conversationId: string,
    listener: (event: ChatRealtimeEvent) => void,
  ): () => void {
    const ck = this.convKey(conversationKind, conversationId);
    const redisCh = this.redisChannel(conversationKind, conversationId);

    let listeners = this.localListeners.get(ck);

    if (!listeners) {
      listeners = new Set();
      this.localListeners.set(ck, listeners);
    }

    listeners.add(listener);

    const nextRef = (this.redisSubscriptionRefCount.get(redisCh) ?? 0) + 1;

    this.redisSubscriptionRefCount.set(redisCh, nextRef);

    if (nextRef === 1) {
      void this.ensureSubscriber()
        .subscribe(redisCh)
        .catch((error: unknown) => {
          this.logger.error(
            `Redis subscribe failed for ${redisCh}`,
            error instanceof Error ? error.stack : String(error),
          );
          this.redisSubscriptionRefCount.delete(redisCh);
        });
    }

    return () => {
      const currentListeners = this.localListeners.get(ck);

      if (currentListeners) {
        currentListeners.delete(listener);

        if (currentListeners.size === 0) {
          this.localListeners.delete(ck);
        }
      }

      const ref = (this.redisSubscriptionRefCount.get(redisCh) ?? 1) - 1;

      if (ref <= 0) {
        this.redisSubscriptionRefCount.delete(redisCh);
        void this.ensureSubscriber().unsubscribe(redisCh).catch(() => {});
      } else {
        this.redisSubscriptionRefCount.set(redisCh, ref);
      }
    };
  }

  publish(
    conversationKind: 'channel' | 'dm',
    conversationId: string,
    event: ChatRealtimeEvent,
  ): void {
    const ck = this.convKey(conversationKind, conversationId);
    const redisCh = this.redisChannel(conversationKind, conversationId);
    const payload = JSON.stringify(event);

    void this.redisClientService
      .getClient()
      .publish(redisCh, payload)
      .catch((error: unknown) => {
        this.logger.warn(
          `Redis publish failed for ${redisCh}`,
          error instanceof Error ? error.message : String(error),
        );
      });
    this.notifyLocal(ck, event);
  }

  subscribeInbox(
    workspaceId: string,
    userWorkspaceId: string,
    listener: (event: ChatInboxRealtimeEvent) => void,
  ): () => void {
    const ck = this.inboxLocalKey(workspaceId, userWorkspaceId);
    const redisCh = this.redisInboxChannel(workspaceId, userWorkspaceId);

    let listeners = this.inboxListeners.get(ck);

    if (!listeners) {
      listeners = new Set();
      this.inboxListeners.set(ck, listeners);
    }

    listeners.add(listener);

    const nextRef = (this.redisSubscriptionRefCount.get(redisCh) ?? 0) + 1;

    this.redisSubscriptionRefCount.set(redisCh, nextRef);

    if (nextRef === 1) {
      void this.ensureSubscriber()
        .subscribe(redisCh)
        .catch((error: unknown) => {
          this.logger.error(
            `Redis subscribe failed for ${redisCh}`,
            error instanceof Error ? error.stack : String(error),
          );
          this.redisSubscriptionRefCount.delete(redisCh);
        });
    }

    return () => {
      const currentListeners = this.inboxListeners.get(ck);

      if (currentListeners) {
        currentListeners.delete(listener);

        if (currentListeners.size === 0) {
          this.inboxListeners.delete(ck);
        }
      }

      const ref = (this.redisSubscriptionRefCount.get(redisCh) ?? 1) - 1;

      if (ref <= 0) {
        this.redisSubscriptionRefCount.delete(redisCh);
        void this.ensureSubscriber().unsubscribe(redisCh).catch(() => {});
      } else {
        this.redisSubscriptionRefCount.set(redisCh, ref);
      }
    };
  }

  publishInbox(
    workspaceId: string,
    userWorkspaceId: string,
    event: ChatInboxRealtimeEvent,
  ): void {
    const ck = this.inboxLocalKey(workspaceId, userWorkspaceId);
    const redisCh = this.redisInboxChannel(workspaceId, userWorkspaceId);
    const payload = JSON.stringify(event);

    void this.redisClientService
      .getClient()
      .publish(redisCh, payload)
      .catch((error: unknown) => {
        this.logger.warn(
          `Redis publish failed for ${redisCh}`,
          error instanceof Error ? error.message : String(error),
        );
      });
    this.notifyInboxLocal(ck, event);
  }

  /** @deprecated Use publish() with a typed event */
  publishMessageCreated(params: {
    conversationKind: 'channel' | 'dm';
    conversationId: string;
    messageId: string;
    createdAt: Date;
  }) {
    this.publish(params.conversationKind, params.conversationId, {
      type: 'message-created',
      messageId: params.messageId,
      createdAt: params.createdAt.toISOString(),
    });
  }

  private notifyLocal(convKey: string, event: ChatRealtimeEvent): void {
    const listeners = this.localListeners.get(convKey);

    if (!listeners) {
      return;
    }

    for (const fn of listeners) {
      try {
        fn(event);
      } catch (error: unknown) {
        this.logger.warn(
          'Chat realtime listener error',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  private notifyInboxLocal(
    inboxKey: string,
    event: ChatInboxRealtimeEvent,
  ): void {
    const listeners = this.inboxListeners.get(inboxKey);

    if (!listeners) {
      return;
    }

    for (const fn of listeners) {
      try {
        fn(event);
      } catch (error: unknown) {
        this.logger.warn(
          'Chat inbox listener error',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriberReconnectTimer) {
      clearTimeout(this.subscriberReconnectTimer);
      this.subscriberReconnectTimer = null;
    }
    this.destroySubscriber();
  }
}
