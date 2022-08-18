export interface LeaderboardsMetadata {
  name: string;
  title: string;
}

export interface PlayerMetadata {
  platformId: number;
  platformSlug: string;
  platformUserHandle: string;
  platformUserIdentifier: string;
  countryCode: string;
  pictureUrl: string;
  avatarUrl: string;
  isPremium: boolean;
  twitch: string;
}

export interface StatsMetadata {
  key: string;
  name: string;
  description?: any;
  categoryKey?: any;
  categoryName?: any;
  isReversed: boolean;
  iconUrl?: any;
  color?: any;
  value?: any;
  displayValue?: any;
}

export interface Stat {
  metadata: StatsMetadata;
  percentile?: any;
  rank?: any;
  displayPercentile?: any;
  displayRank?: any;
  value: number;
  displayValue: string;
}

export interface LeaderboardsEntryOwner {
  id: string;
  type: string;
  metadata: PlayerMetadata;
  stats: Stat[];
}

export interface LeaderboardsEntry {
  id: string;
  owner: LeaderboardsEntryOwner;
  value: number;
  displayValue: string;
  rank: number;
  percentile?: any;
  iconUrl?: any;
  characterName?: string;
}

export interface LeaderboardsData {
  id: string;
  metadata: LeaderboardsMetadata;
  items: LeaderboardsEntry[];
  expiryDate: Date;
  lastUpdated?: any;
  notices?: any;
  filename: string;
}
