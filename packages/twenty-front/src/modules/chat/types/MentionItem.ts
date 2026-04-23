export type MentionItem =
  | {
      kind: 'konnecctai';
      label: string;
    }
  | {
      kind: 'agent';
      label: string;
      recordId: string;
    }
  | {
      kind: 'user';
      label: string;
      userId: string;
    }
  | {
      kind: 'crm';
      label: string;
      objectNameSingular: string;
      objectLabelSingular: string;
      recordId: string;
      href: string;
      imageUrl?: string;
    };
