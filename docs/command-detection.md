# Command Detection System

This document explains how Juno detects AI commands in transcribed text.

## Overview

Juno can recognize AI commands in two ways:

1. **Trigger Word Detection**: When you use the configured trigger word (default: "Juno")
2. **Action Verb Detection**: When you start with specific action verbs (e.g., "summarize", "explain")

The system uses a sophisticated confidence scoring mechanism to minimize false positives while still recognizing natural language commands.

## Trigger Word Detection

The trigger word (default: "Juno") can be used in several ways:

- Direct: "Juno, summarize this text"
- With greeting: "Hey Juno, summarize this text"
- With multiple greetings: "Hey, hi Juno, summarize this text"

Recognized greetings include: hey, hi, hello, yo, ok, okay, um, uh

## Action Verb Detection

Action verbs allow you to skip the trigger word and directly issue commands:

- Direct: "Summarize this text"
- Question form: "Can you summarize this text?"
- With intent: "I want you to summarize this text"

The system recognizes action verbs in various positions and contexts to accommodate natural speech patterns.

## Confidence Scoring System

To minimize false positives, the system uses a confidence scoring mechanism that considers:

1. **Pattern Strength**: How closely the text matches known command patterns
2. **Presence of Deictic Words**: Words like "this", "that", "these" that indicate reference
3. **Command Context**: Phrases like "I want you to" or "can you help me"
4. **User Context**: Whether text is highlighted, recent AI usage, etc.

Commands are only recognized when the confidence score exceeds a threshold (default: 60%).

## Configuration Options

You can configure the command detection system in the settings:

1. **Trigger Word**: Change the default "Juno" to any word you prefer
2. **Action Verbs**: Add, remove, or modify the list of recognized action verbs
3. **Enable/Disable Action Verbs**: Toggle whether action verbs are recognized at all

If you disable action verb detection, only the trigger word will be recognized.

## Examples

Here are examples of what will and won't be recognized as commands:

### Recognized as Commands

- "Juno, what's the weather today?"
- "Hey Juno, summarize this article"
- "Summarize this text for me"
- "Can you explain this code?"
- "I need you to translate this paragraph"

### Not Recognized as Commands

- "I was summarizing the meeting notes yesterday" (no deictic words, not at start)
- "The summary of the report is as follows" ("summary" is a noun, not the verb "summarize")
- "Can I explain my reasoning?" ("I" as subject, not "you")

## Troubleshooting

If the system is not recognizing your commands:

1. Check that action verb detection is enabled in settings
2. Try using the trigger word explicitly
3. Start with a clear action verb followed by "this" or "that"
4. Use question forms like "Can you [verb]" or "Could you [verb]"

If the system is incorrectly recognizing normal speech as commands:

1. Disable action verb detection in settings
2. Remove problematic verbs from your action verb list
3. Use more explicit trigger words that wouldn't appear in normal dictation 