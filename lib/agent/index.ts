// Public entry points of the AI agent module (NFR-18, §13.2). Code outside
// lib/agent and app/api/agent imports from here only.
export { getAgentConfig, saveAgentConfig, ConfigSaveSchema, ConfigVersionConflict, yearsOfExperience, type AgentConfig } from "./config";
export { pickPagePrompt } from "./pagePrompts";
export { widgetAllowedOn, loadOwnedConversation, apiError, fallbackFor, OBJECT_ID } from "./http";
export { recalculateLeadScore } from "./scoring/recalc";
export { requireCapability, getAgentStaff, can, conversationCap, type Capability } from "./security/authorization";
