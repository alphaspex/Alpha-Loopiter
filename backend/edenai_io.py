"""
Pure I/O module for interacting with Eden AI API endpoint using ternary-bonsai-27b model.
Input: API key, system prompt, message history / user prompt.
Output: LLM completion text string or structured response dictionary.
"""

import os
import requests
from typing import List, Dict, Any, Optional

EDEN_AI_URL = "https://api.edenai.run/v3/chat/completions"
DEFAULT_MODEL = "ternary-bonsai-27b"

def call_edenai_io(
    messages: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL
) -> Dict[str, Any]:
    """
    Pure I/O function to call Eden AI Chat Completion API.
    Does not crash if network issues occur; returns isolated error response dict.
    """
    key = api_key or os.environ.get("API_KEY") or os.environ.get("GEMINI_API_KEY") or ""
    
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    formatted_messages = []
    if system_prompt:
        formatted_messages.append({"role": "system", "content": system_prompt})
    
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        formatted_messages.append({"role": role, "content": content})

    payload = {
        "model": model,
        "messages": formatted_messages
    }

    try:
        response = requests.post(EDEN_AI_URL, headers=headers, json=payload, timeout=60)
        if response.status_code == 200:
            res_json = response.json()
            # Extract content from standardized response format
            text = ""
            if "choices" in res_json and len(res_json["choices"]) > 0:
                choice = res_json["choices"][0]
                if "message" in choice and "content" in choice["message"]:
                    text = choice["message"]["content"]
                elif "text" in choice:
                    text = choice["text"]
            elif "content" in res_json:
                text = res_json["content"]
            elif "text" in res_json:
                text = res_json["text"]
            else:
                text = str(res_json)
            
            return {
                "success": True,
                "text": text,
                "raw": res_json
            }
        else:
            return {
                "success": False,
                "text": f"Eden AI API Error ({response.status_code}): {response.text}",
                "error": response.text
            }
    except Exception as e:
        return {
            "success": False,
            "text": f"Network / Execution Error: {str(e)}",
            "error": str(e)
        }
