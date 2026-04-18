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
      kind: 'crm';
      label: string;
      objectNameSingular: string;
      objectLabelSingular: string;
      recordId: string;
      href: string;
    };
