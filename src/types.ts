export type SinEntry = {
  date_time: string;
  sin: string;
  manifestation: string;
};

export type PunishmentEntry = {
  date_time: string;
  reason: string;
  punishment: string;
};

export type UserRecord = {
  sins_count: number;
  sins: SinEntry[];
  punishments: PunishmentEntry[];
};

export type ChatRecord = {
  users: Record<string, UserRecord>;
};

export type StorageShape = {
  chats: Record<string, ChatRecord>;
};

export type ChatMessage = {
  userId: string;
  username: string;
  text: string;
  date_time: string;
};

export type SinDetection = {
  is_sin: boolean;
  sin_name: string;
  manifestation: string;
};
