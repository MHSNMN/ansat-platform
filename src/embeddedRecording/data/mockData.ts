// @ts-nocheck
import { User, Book, AudioRecording, ActivityLog } from "../types";

export const INITIAL_USERS: User[] = [];

export const INITIAL_BOOKS: Book[] = [];

export const INITIAL_RECORDINGS: AudioRecording[] = [];

export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];

export const SUPABASE_SQL_SCHEMA = `-- Legacy setup is disabled. Use the reviewed migrations in supabase/migrations/ and verify RLS policies before deployment.`;
