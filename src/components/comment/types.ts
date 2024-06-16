export interface CommentConfig {
  frontend_conf: FrontendConf;
}

export interface FrontendConf {
  flatMode: boolean;
  gravatar: Gravatar;
  pagination: Pagination;
}

export interface Gravatar {
  mirror: string;
  params: string;
}

export interface Pagination {
  pageSize: number;
}

export interface Comments {
  comments: Comment[];
  count: number;
  roots_count: number;
}

export interface Comment {
  id: number;
  content: string;
  nick: string;
  email_encrypted: string;
  link: string;
  date: string;
  rid: number;
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
export interface CommentResp extends Comment {
  is_pending: boolean;
}

export interface ErrorResp {
  msg: string;
}
