import type { Application as ExpressFeathers } from '@feathersjs/express';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceTypes {}

export type Application = ExpressFeathers<ServiceTypes>;

export interface ChatUser {
  id: string;
  username: string;
  personalData?: Array<{
    firstName?: string;
    lastName?: string;
  }>;
}

export interface Conversation {
  id: string;
  name: string | null;
  participants?: ConversationParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStatus {
  id: string;
  userId: string;
  status: 'online' | 'offline' | 'away' | 'dnd';
  text: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
