import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════
// Database Schema — run this in Supabase SQL editor
// ═══════════════════════════════════════════
export const SCHEMA_SQL = `
-- Conversations: every exchange with Chef
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  module text, -- 'morning_brief', 'customer_issue', 'market_scan', etc.
  voice_input boolean default false,
  metadata jsonb default '{}'
);

-- Action Log: everything EVA does autonomously
create table if not exists action_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  action_type text not null, -- 'email_sent', 'inventory_flagged', 'brief_generated', etc.
  description text not null,
  status text default 'completed' check (status in ('completed', 'pending_approval', 'rejected', 'failed')),
  requires_approval boolean default false,
  approved boolean,
  details jsonb default '{}'
);

-- Learning Log: tracks what Chef acts on vs ignores
create table if not exists learning_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  topic text not null, -- 'ip_filing', 'inventory_fix', 'customer_response', etc.
  recommendation text not null,
  outcome text check (outcome in ('acted', 'ignored', 'deferred', 'modified', 'pending')),
  times_raised integer default 1,
  notes text,
  resolved_at timestamptz
);

-- Avoidance Tracker: things Chef keeps pushing off
create table if not exists avoidance_tracker (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  item text not null,
  times_raised integer default 1,
  last_raised timestamptz default now(),
  status text default 'open' check (status in ('open', 'resolved', 'abandoned')),
  escalation_level integer default 1, -- 1=gentle, 2=firm, 3=direct confrontation
  notes text
);

-- Preferences: EVA's evolving understanding of Chef's patterns
create table if not exists preferences (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_conversations_created on conversations(created_at desc);
create index if not exists idx_action_log_created on action_log(created_at desc);
create index if not exists idx_action_log_pending on action_log(status) where status = 'pending_approval';
create index if not exists idx_learning_log_pending on learning_log(outcome) where outcome = 'pending';
create index if not exists idx_avoidance_open on avoidance_tracker(status) where status = 'open';
`;

// ═══════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════

export async function logConversation(role: string, content: string, module?: string, voiceInput?: boolean) {
  return supabase.from('conversations').insert({
    role, content, module, voice_input: voiceInput,
  });
}

export async function logAction(actionType: string, description: string, requiresApproval = false, details = {}) {
  return supabase.from('action_log').insert({
    action_type: actionType,
    description,
    requires_approval: requiresApproval,
    status: requiresApproval ? 'pending_approval' : 'completed',
    details,
  });
}

export async function logLearning(topic: string, recommendation: string) {
  return supabase.from('learning_log').insert({
    topic, recommendation, outcome: 'pending',
  });
}

export async function trackAvoidance(item: string) {
  // Check if this item already exists
  const { data } = await supabase
    .from('avoidance_tracker')
    .select('*')
    .eq('item', item)
    .eq('status', 'open')
    .single();

  if (data) {
    // Increment times_raised and escalation_level
    const newLevel = Math.min(data.escalation_level + 1, 3);
    return supabase.from('avoidance_tracker').update({
      times_raised: data.times_raised + 1,
      last_raised: new Date().toISOString(),
      escalation_level: newLevel,
      updated_at: new Date().toISOString(),
    }).eq('id', data.id);
  } else {
    return supabase.from('avoidance_tracker').insert({ item });
  }
}

export async function getPendingApprovals() {
  return supabase
    .from('action_log')
    .select('*')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false });
}

export async function getOpenAvoidanceItems() {
  return supabase
    .from('avoidance_tracker')
    .select('*')
    .eq('status', 'open')
    .order('escalation_level', { ascending: false });
}

export async function getRecentConversations(limit = 20) {
  return supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
}

export async function getRecentActions(limit = 10) {
  return supabase
    .from('action_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
}
