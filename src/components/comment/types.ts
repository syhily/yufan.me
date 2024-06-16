export interface CommentConfig {
  frontend_conf: FrontendConf;
  version: Version;
}

export interface FrontendConf {
  flatMode: boolean;
  gravatar: Gravatar;
  listSort: boolean;
  locale: string;
  nestMax: number;
  nestSort: string;
  noComment: string;
  pagination: Pagination;
  placeholder: string;
  preview: boolean;
  reqTimeout: number;
  sendBtn: string;
  uaBadge: boolean;
}

export interface Gravatar {
  mirror: string;
  params: string;
}

export interface Pagination {
  autoLoad: boolean;
  pageSize: number;
  readMore: boolean;
}

export interface Version {
  app: string;
  version: string;
  commit_hash: string;
}

export interface Comments {
  comments: Comment[];
  count: number;
  roots_count: number;
  page: Page;
}

export interface Comment {
  id: number;
  content: string;
  content_marked: string;
  user_id: number;
  nick: string;
  email_encrypted: string;
  link: string;
  ua: string;
  date: string;
  is_collapsed: boolean;
  is_pending: boolean;
  is_pinned: boolean;
  is_allow_reply: boolean;
  is_verified: boolean;
  rid: number;
  badge_name: string;
  badge_color: string;
  visible: boolean;
  vote_up: number;
  vote_down: number;
  page_key: string;
  page_url: string;
  site_name: string;
}

export interface Page {
  id: number;
  admin_only: boolean;
  key: string;
  url: string;
  title: string;
  site_name: string;
  vote_up: number;
  vote_down: number;
  pv: number;
  date: string;
}

export interface PV {
  page_key: string;
  page_title: string;
  site_name: string;
}

export interface CommentItem extends Comment {
  children?: CommentItem[];
}

// Create comment request
export interface CommentReq {
  page_key: string;
  name: string;
  email: string;
  link?: string;
  content: string;
  rid?: number;
}

// Create comment response
export interface CommentResp {
  badge_color: string;
  badge_name: string;
  content: string;
  content_marked: string;
  date: string;
  email_encrypted: string;
  id: number;
  ip_region: string;
  is_allow_reply: boolean;
  is_collapsed: boolean;
  is_pending: boolean;
  is_pinned: boolean;
  is_verified: boolean;
  link: string;
  nick: string;
  page_key: string;
  page_url: string;
  rid: number;
  site_name: string;
  ua: string;
  user_id: number;
  visible: boolean;
  vote_down: number;
  vote_up: number;
}

export interface ErrorResp {
  msg: string;
}
