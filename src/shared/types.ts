export interface DocPage {
  id: string;
  title: string;
  library: string;
  url: string;
  content: string;
  tokens: number;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  library: string;
  score: number;
}
