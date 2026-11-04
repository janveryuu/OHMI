"use client";

import React, { useState, useMemo } from "react";
import { Check, Copy, Code as CodeIcon } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

// Token categories for syntax highlighting
type TokenType =
  | "comment"
  | "preprocessor"
  | "keyword"
  | "constant"
  | "builtin"
  | "string"
  | "number"
  | "plain";

interface Token {
  type: TokenType;
  text: string;
}

const ARDUINO_KEYWORDS = new Set([
  "void", "int", "const", "bool", "boolean", "char", "byte", "float",
  "double", "long", "unsigned", "short", "size_t", "uint8_t", "uint16_t",
  "uint32_t", "int8_t", "int16_t", "int32_t", "auto", "static", "volatile",
  "if", "else", "for", "while", "do", "return", "switch", "case", "break",
  "continue", "default", "class", "struct", "new", "delete", "sizeof",
]);

const ARDUINO_CONSTANTS = new Set([
  "HIGH", "LOW", "INPUT", "OUTPUT", "INPUT_PULLUP", "LED_BUILTIN",
  "true", "false", "NULL", "null", "DEC", "HEX", "BIN", "OCT",
  "LSBFIRST", "MSBFIRST", "CHANGE", "FALLING", "RISING",
]);

const ARDUINO_BUILTINS = new Set([
  "setup", "loop", "pinMode", "digitalWrite", "digitalRead", "analogRead",
  "analogWrite", "analogReference", "delay", "delayMicroseconds", "millis",
  "micros", "pulseIn", "pulseInLong", "shiftOut", "shiftIn", "tone", "noTone",
  "min", "max", "abs", "constrain", "map", "pow", "sqrt", "sin", "cos", "tan",
  "random", "randomSeed", "attachInterrupt", "detachInterrupt", "interrupts",
  "noInterrupts", "Serial", "begin", "print", "println", "write", "available",
  "read", "flush", "peek", "Wire", "SPI", "EEPROM",
]);

/**
 * Lightweight, deterministic tokenizer for Arduino C++ code
 */
function tokenizeArduino(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // 1. Single-line comment
    if (code[i] === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      const text = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ type: "comment", text });
      i += text.length;
      continue;
    }

    // 2. Multi-line comment
    if (code[i] === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      const text = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      tokens.push({ type: "comment", text });
      i += text.length;
      continue;
    }

    // 3. Preprocessor directive
    if (code[i] === "#") {
      let j = i + 1;
      while (j < len && /[a-zA-Z_]/.test(code[j])) j++;
      const text = code.slice(i, j);
      tokens.push({ type: "preprocessor", text });
      i = j;
      continue;
    }

    // 4. Strings & Character literals
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      while (j < len && code[j] !== quote && code[j] !== "\n") {
        if (code[j] === "\\" && j + 1 < len) j += 2;
        else j++;
      }
      if (j < len && code[j] === quote) j++;
      const text = code.slice(i, j);
      tokens.push({ type: "string", text });
      i = j;
      continue;
    }

    // 5. Numbers (hex, binary, float, int)
    if (/\d/.test(code[i]) || (code[i] === "." && /\d/.test(code[i + 1] || ""))) {
      let j = i;
      if (code[j] === "0" && (code[j + 1] === "x" || code[j + 1] === "X")) {
        j += 2;
        while (j < len && /[0-9a-fA-F_]/.test(code[j])) j++;
      } else if (code[j] === "0" && (code[j + 1] === "b" || code[j + 1] === "B")) {
        j += 2;
        while (j < len && /[01_]/.test(code[j])) j++;
      } else {
        while (j < len && /[0-9._a-zA-Z]/.test(code[j])) j++;
      }
      const text = code.slice(i, j);
      tokens.push({ type: "number", text });
      i = j;
      continue;
    }

    // 6. Identifiers (Keywords, Constants, Functions)
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const text = code.slice(i, j);

      if (ARDUINO_KEYWORDS.has(text)) {
        tokens.push({ type: "keyword", text });
      } else if (ARDUINO_CONSTANTS.has(text)) {
        tokens.push({ type: "constant", text });
      } else if (ARDUINO_BUILTINS.has(text)) {
        tokens.push({ type: "builtin", text });
      } else {
        tokens.push({ type: "plain", text });
      }
      i = j;
      continue;
    }

    // 7. Symbols, operators, whitespace
    tokens.push({ type: "plain", text: code[i] });
    i++;
  }

  return tokens;
}

export function CodeBlock({
  code,
  language = "cpp",
  filename,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const displayLanguage = useMemo(() => {
    const lang = (language || "").toLowerCase();
    if (lang === "cpp" || lang === "arduino" || lang === "ino" || lang === "c") {
      return "Arduino C++";
    }
    if (lang === "javascript" || lang === "js") return "JavaScript";
    if (lang === "typescript" || lang === "ts") return "TypeScript";
    if (lang === "json") return "JSON";
    if (lang === "python" || lang === "py") return "Python";
    return lang.toUpperCase() || "Code";
  }, [language]);

  const displayTitle = filename || (displayLanguage === "Arduino C++" ? "sketch.ino" : displayLanguage);

  const tokens = useMemo(() => {
    return tokenizeArduino(code);
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is blocked
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`my-3 rounded-2xl overflow-hidden border border-border/70 bg-[#121418] text-[#e4e4e7] shadow-md dark:border-border/40 ${className}`}
      data-testid="code-block"
    >
      {/* Code Window Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#181a1f] border-b border-white/5 select-none">
        <div className="flex items-center gap-2.5">
          {/* iOS / macOS style window control dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] opacity-80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] opacity-80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] opacity-80" />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-300">
            <CodeIcon className="w-3.5 h-3.5 text-teal-400" />
            <span>{displayTitle}</span>
            <span className="text-[10px] text-neutral-400 font-sans px-1.5 py-0.2 rounded bg-white/5 border border-white/5">
              {displayLanguage}
            </span>
          </div>
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
            copied
              ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
              : "bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 hover:text-white"
          }`}
          aria-label={copied ? "Code copied to clipboard" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-teal-400 stroke-[2.5]" />
              <span className="text-[11px] font-semibold text-teal-300">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px]">Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content Container */}
      <pre
        tabIndex={0}
        aria-label={`${displayLanguage} code snippet`}
        className="m-0 p-4 overflow-x-auto text-xs leading-relaxed font-mono whitespace-pre selection:bg-teal-500/30 selection:text-white"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        }}
      >
        <code>
          {tokens.map((token, idx) => {
            let color = "text-[#e4e4e7]";

            switch (token.type) {
              case "keyword":
                color = "text-[#d19a66] font-semibold"; // warm orange-amber keywords
                break;
              case "constant":
                color = "text-[#e5c07b] font-semibold"; // yellow-gold constants
                break;
              case "builtin":
                color = "text-[#61afef]"; // light blue functions
                break;
              case "string":
                color = "text-[#98c379]"; // mint-sage strings
                break;
              case "number":
                color = "text-[#e5c07b]"; // golden numbers
                break;
              case "comment":
                color = "text-[#7f848e] italic"; // muted gray comment
                break;
              case "preprocessor":
                color = "text-[#c678dd] font-semibold"; // purple preprocessor
                break;
              default:
                color = "text-[#e4e4e7]";
            }

            return (
              <span key={idx} className={color}>
                {token.text}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
