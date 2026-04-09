import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamChat } from 'stream-chat';

@Injectable()
export class StreamAuthService {
  constructor(private readonly configService: ConfigService) {}

  private get apiKey() {
    return this.configService.get<string>('STREAM_API_KEY') ?? '';
  }

  private get apiSecret() {
    return this.configService.get<string>('STREAM_API_SECRET') ?? '';
  }

  private get serverClient() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        'Stream is not configured (STREAM_API_KEY, STREAM_API_SECRET).',
      );
    }

    return StreamChat.getInstance(this.apiKey, this.apiSecret);
  }

  async createUserToken(userId: string) {
    const client = this.serverClient;

    await client.upsertUser({
      id: userId,
      name: userId,
    });

    const token = client.createToken(userId);

    return {
      apiKey: this.apiKey,
      token,
      userId,
    };
  }
}
