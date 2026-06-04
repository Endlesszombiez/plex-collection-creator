"use client";

import { useState } from "react";
import { useAIConfig } from "@/hooks/use-ai-config";
import { AIProvider, AI_PROVIDERS, getProviderInfo } from "@/lib/ai/types";

function LoadingSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

interface AIConfigCardProps {
  onComplete?: () => void;
}

export function AIConfigCard({ onComplete }: AIConfigCardProps) {
  const {
    configured,
    provider: savedProvider,
    providerName,
    source,
    isLoading,
    isSaving,
    isTesting,
    testResult,
    error,
    testConnection,
    saveConfig,
    clearConfig,
    clearTestResult,
  } = useAIConfig();

  // Use savedProvider as initial value, fallback to "anthropic" if not configured
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    savedProvider || "anthropic"
  );
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  const providerInfo = getProviderInfo(selectedProvider);

  // Handle provider change with form reset
  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setCredentials({});
    clearTestResult();
  };

  const handleFieldChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    clearTestResult();
  };

  const handleTest = async () => {
    await testConnection(selectedProvider, credentials);
  };

  const handleSave = async () => {
    const success = await saveConfig(selectedProvider, credentials);
    if (success) {
      setShowForm(false);
      setCredentials({});
      onComplete?.();
    }
  };

  const handleDisconnect = async () => {
    await clearConfig();
    setShowForm(false);
    setCredentials({});
  };

  const isFormValid = providerInfo?.requiredFields.every(
    (field) => !field.required || credentials[field.key]
  );

  // Loading state - skeleton matches loaded structure
  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse" />
              <div>
                <div className="h-5 w-24 bg-white/10 rounded animate-pulse mb-1.5" />
                <div className="h-4 w-36 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-24 bg-white/5 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-2">
          <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-white/5 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  // Configured state (not editing)
  if (configured && !showForm) {
    const isFromEnv = source === "env";

    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20">
                <SparklesIcon className="h-6 w-6 text-emerald-400" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[#1a1a1a]">
                  <CheckIcon className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-0.5">AI Provider</h3>
                <p className="text-sm text-white/50">
                  Connected to {providerName}
                </p>
                {isFromEnv && (
                  <p className="text-xs text-emerald-400/70 mt-1">
                    Configured via environment variable
                  </p>
                )}
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
              Configured
            </div>
          </div>
        </div>

        {!isFromEnv && (
          <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            >
              Change Provider
            </button>
            <button
              onClick={handleDisconnect}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Configuration form
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Provider Selection */}
      <div className="p-6 border-b border-white/5">
        <h3 className="text-sm font-medium text-white/80 mb-4">Select Provider</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AI_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleProviderChange(provider.id)}
              className={`
                flex flex-col items-start p-3 rounded-lg text-left transition-all
                ${selectedProvider === provider.id
                  ? "bg-[#E5A00D]/10 border border-[#E5A00D]/30"
                  : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                }
              `}
            >
              <span className={`font-medium text-sm ${
                selectedProvider === provider.id ? "text-[#E5A00D]" : "text-white"
              }`}>
                {provider.name}
              </span>
              <span className="text-xs text-white/40 mt-0.5">{provider.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Credential Fields */}
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-medium text-white/80">Credentials</h3>

        {providerInfo?.requiredFields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm text-white/60 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {field.type === "select" ? (
              <select
                value={credentials[field.key] || ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:border-[#E5A00D]/50 focus:ring-1 focus:ring-[#E5A00D]/50 outline-none transition-all"
              >
                <option value="" className="bg-[#1a1a1a]">Select {field.label.toLowerCase()}...</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                value={credentials[field.key] || ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-[#E5A00D]/50 focus:ring-1 focus:ring-[#E5A00D]/50 outline-none transition-all"
              />
            )}
            {field.helpText && (
              <p className="text-xs text-white/40 mt-1">{field.helpText}</p>
            )}
          </div>
        ))}

        {/* Test Result */}
        {testResult && (
          <div className={`p-3 rounded-lg border ${
            testResult.success
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}>
            <p className={`text-sm ${testResult.success ? "text-emerald-400" : "text-red-400"}`}>
              {testResult.message}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-white/5">
        {/* Hint about test requirement */}
        {isFormValid && !testResult?.success && (
          <p className="text-xs text-white/40 mb-3 text-center">
            Test your connection to enable saving
          </p>
        )}
        <div className="flex justify-between">
          {configured && (
            <button
              onClick={() => {
                setShowForm(false);
                setCredentials({});
                clearTestResult();
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            >
              Cancel
            </button>
          )}
          <div className={`flex gap-2 ${!configured ? "ml-auto" : ""}`}>
            <button
              onClick={handleTest}
              disabled={!isFormValid || isTesting}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                !testResult?.success && isFormValid
                  ? "bg-[#E5A00D] hover:bg-[#E5A00D]/90 active:bg-[#E5A00D]/80 text-black shadow-lg shadow-[#E5A00D]/20"
                  : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10"
              }`}
            >
              {isTesting ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={!isFormValid || isSaving || !testResult?.success}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#E5A00D] hover:bg-[#E5A00D]/90 active:bg-[#E5A00D]/80 text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#E5A00D]/20"
            >
              {isSaving ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
