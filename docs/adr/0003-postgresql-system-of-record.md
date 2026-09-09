# ADR 0003 — PostgreSQL as System of Record

Status: Accepted

## Decision
Use PostgreSQL for user, resource, project, decision and context-version data.

## Why
The domain is strongly relational with useful JSONB flexibility. One DB avoids early operational complexity.
