import { MentionChip } from '@/mention/components/MentionChip';
import { Node } from '@tiptap/core';
import { mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react';

export const MentionTag = Node.create({
  name: 'mentionTag',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes: () => ({
    mentionType: {
      default: 'record',
      parseHTML: (element) => element.getAttribute('data-mention-type'),
      renderHTML: (attributes) => ({
        'data-mention-type': attributes.mentionType,
      }),
    },
    recordId: {
      default: null,
      parseHTML: (element) => element.getAttribute('data-record-id'),
      renderHTML: (attributes) => ({
        'data-record-id': attributes.recordId,
      }),
    },
    objectNameSingular: {
      default: null,
      parseHTML: (element) => element.getAttribute('data-object-name-singular'),
      renderHTML: (attributes) => ({
        'data-object-name-singular': attributes.objectNameSingular,
      }),
    },
    label: {
      default: '',
      parseHTML: (element) => element.getAttribute('data-label'),
      renderHTML: (attributes) => ({
        'data-label': attributes.label,
      }),
    },
    imageUrl: {
      default: '',
      parseHTML: (element) => element.getAttribute('data-image-url'),
      renderHTML: (attributes) => ({
        'data-image-url': attributes.imageUrl,
      }),
    },
  }),

  renderHTML: ({ node, HTMLAttributes }) => {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'mentionTag',
        class: 'mention-tag',
      }),
      `@${node.attrs.label}`,
    ];
  },

  addNodeView: () => {
    return ReactNodeViewRenderer(MentionChip);
  },

  renderText: ({ node }) => {
    const { mentionType, objectNameSingular, recordId, label } = node.attrs;

    if (mentionType === 'agent') {
      return `[[agent:${recordId}:${label}]]`;
    }

    return `[[record:${objectNameSingular}:${recordId}:${label}]]`;
  },
});
