export interface StandaloneConfig {
  deploymentUrl: string;
  assistantId: string;
  langsmithApiKey?: string;
}

const PRODUCTION_RENDER_BACKEND = "https://printway-product-hub-backend.onrender.com";

function getResolvedDeploymentUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return PRODUCTION_RENDER_BACKEND;
    }
  }
  return (
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
    process.env.NEXT_PUBLIC_DEPLOYMENT_URL ||
    PRODUCTION_RENDER_BACKEND
  );
}

export const DEFAULT_CONFIG: StandaloneConfig = {
  deploymentUrl: PRODUCTION_RENDER_BACKEND,
  assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID || "product_opportunity_hub",
  langsmithApiKey: process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || "",
};

export function getConfig(): StandaloneConfig {
  return {
    deploymentUrl: getResolvedDeploymentUrl(),
    assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID || DEFAULT_CONFIG.assistantId,
    langsmithApiKey: process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || DEFAULT_CONFIG.langsmithApiKey,
  };
}
