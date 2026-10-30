#!/usr/bin/env node
/**
 * Custom API Runner for subagent-dispatch
 *
 * Reads a dispatch prompt from stdin and sends it to a user-configured API.
 * The API endpoint and key are expected via environment variables:
   - CUSTOM_API_URL: The API endpoint URL
   - CUSTOM_API_KEY: Authentication key/token
   - CUSTOM_MODEL: Optional model name to use
   - CUSTOM_API_TIMEOUT: Optional timeout in milliseconds (default 900000)
 *
 * Outputs the API response to stdout and exits with the API's exit code behavior.
 *
 * Usage as --runner: node scripts/custom-api-runner.mjs
 *   or set DISPATCH_RUNNER="node scripts/custom-api-runner.mjs"
 *
 * This is a template - users must configure CUSTOM_API_URL and CUSTOM_API_KEY
 * for their specific AI provider.
 */

import fs from 'node:fs';
import https from 'node:https';
import { URL } from 'node:url';

// Configuration from environment
const API_URL = String(process.env.CUSTOM_API_URL || '').trim();
const API_KEY = String(process.env.CUSTOM_API_KEY || '').trim();
const MODEL = String(process.env.CUSTOM_MODEL || '').trim();
const TIMEOUT_MS = Number(process.env.CUSTOM_API_TIMEOUT || 900000);

if (!API_URL) {
  console.error('Error: CUSTOM_API_URL environment variable not set');
  console.error('Set CUSTOM_API_URL to your API endpoint and CUSTOM_API_KEY to your auth key');
  process.exit(1);
}

if (!API_KEY) {
  console.error('Error: CUSTOM_API_KEY environment variable not set');
  console.error('Set CUSTOM_API_KEY to your API authentication key/token');
  process.exit(1);
}

// Read the full prompt from stdin
let stdinData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  stdinData += chunk;
});

process.stdin.on('end', () => {
  const prompt = stdinData.trim();
  if (!prompt) {
    console.error('Error: No prompt received on stdin');
    process.exit(1);
  }

  // Make API request
  const parsedUrl = new URL(API_URL);
  const options = {
    method: 'POST',
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    timeout: TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
      ...(MODEL ? { 'OpenAI-Model': MODEL } : {})
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        // Output the result to stdout
        process.stdout.write(JSON.stringify({
          success: true,
          model: MODEL || 'custom',
          response: parsed
        }));
        process.exit(0);
      } catch (e) {
        // Output error response
        process.stdout.write(JSON.stringify({
          success: false,
          error: data.substring(0, 2000),
          model: MODEL || 'custom'
        }));
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    process.stdout.write(JSON.stringify({
      success: false,
      error: error.message,
      model: MODEL || 'custom'
    }));
    process.exit(1);
  });

  req.on('timeout', () => {
    req.destroy(new Error('Request timed out'));
  });

  // Send the prompt as JSON
  const requestBody = JSON.stringify({
    prompt,
    model: MODEL || 'custom',
    timestamp: new Date().toISOString()
  });

  req.write(requestBody);
  req.end();
});