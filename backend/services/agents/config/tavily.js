import { TavilySearch } from "@langchain/tavily";

export const searchTool = new TavilySearch({
  maxResults: 5,
  topic: "general",
  includeImages: true,
  // includeAnswer: false,
  // includeRawContent: false,
  // includeImageDescriptions: false,
  // searchDepth: "basic",
  // timeRange: "day",
  // includeDomains: [],
  // excludeDomains: [],
});