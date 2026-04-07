export type MentionSearchResult = {
  mentionType: 'record' | 'agent';
  recordId: string;
  objectNameSingular: string;
  objectLabelSingular: string;
  label: string;
  imageUrl: string;
};
