export interface Analysis {
  data_collection_and_retention: AnalysisSection;
  data_usage: AnalysisSection;
  user_rights_and_controls: AnalysisSection;
}

export interface AnalysisSection {
  score: number;
  justification: string;
  learn_more: string;
} 