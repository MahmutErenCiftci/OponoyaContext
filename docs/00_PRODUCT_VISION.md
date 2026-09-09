# 00 — Product Vision

## One-line definition

DevContext OS is a **personal/team engineering context platform** that stores how a developer prefers to build software and compiles those preferences into project-ready instructions for AI coding tools.

## Problem

AI coding tools are powerful, but developers repeatedly explain the same things:

- preferred frontend framework
- backend language/framework
- database and ORM
- authentication
- deployment target
- UI libraries
- exact components they like
- animation libraries
- saved themes
- starter repositories
- architectural rules
- "never use X" rules
- project-specific exceptions
- which decisions the coding agent is allowed to make

Today these choices live in browser bookmarks, GitHub stars, Notion, chat history, copied prompt files, IDE rules and memory.

The result:
- duplicated setup work
- inconsistent AI output
- dependency drift
- forgotten preferred components
- prompt files that become stale
- poor portability between coding agents

## Product thesis

A developer's engineering system should be structured data, not scattered memory.

The product stores both:

### WHAT
- Next.js
- PostgreSQL
- Animate UI Toggle
- shadcn/ui
- GSAP
- a GitHub starter repo
- a v0 prompt
- a deployment recipe

### INTENT
- use always
- prefer
- let AI decide
- never use
- use only for 3D
- use only in admin screens
- don't rewrite from scratch
- use this theme in SaaS projects

That intent is what turns a bookmark into **AI-usable engineering context**.

## Product pillars

### 1. Library
One searchable place for everything the user builds with.

### 2. Project Composer
A guided project wizard that lets the user explicitly choose or delegate decisions.

### 3. Context Compiler
Deterministically resolves global preferences, presets and project overrides into a clean canonical context.

### 4. Export Adapters
Transforms canonical context into formats appropriate for coding tools.

### 5. Discovery
Helps the user find new resources that fit their existing stack.

## Positioning

Do not market primarily as:
- prompt manager
- bookmark manager
- stack directory
- code generator

Prefer:
- AI Development Workspace
- Developer Context Platform
- Personal Engineering OS
- Developer System of Record

## Core slogan candidates

- Stop re-explaining your stack to AI.
- Save how you build once.
- Your development brain, compiled for every project.
- Everything you use to build software, in one place.
