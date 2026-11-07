export interface PlatformSEOSettings {
  id: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  canonical_url: string;

  og_title: string;
  og_description: string;
  og_image_url?: string | null;

  google_site_verification?: string | null;
  bing_site_verification?: string | null;

  enable_ai_search_indexing: boolean;
  ai_knowledge_brief?: string | null;
  custom_schema_json?: string | null;
  robots_txt_content?: string | null;

  created_at: string;
  updated_at: string;
}

export interface PlatformSEOSettingsUpdatePayload {
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  canonical_url?: string;

  og_title?: string;
  og_description?: string;
  og_image_url?: string | null;

  google_site_verification?: string | null;
  bing_site_verification?: string | null;

  enable_ai_search_indexing?: boolean;
  ai_knowledge_brief?: string | null;
  custom_schema_json?: string | null;
  robots_txt_content?: string | null;
}

export interface PublicSEOMetadata {
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  canonical_url: string;

  og_title: string;
  og_description: string;
  og_image_url?: string | null;

  google_site_verification?: string | null;
  bing_site_verification?: string | null;

  enable_ai_search_indexing: boolean;
  ai_knowledge_brief?: string | null;
  custom_schema_json?: string | null;
}
