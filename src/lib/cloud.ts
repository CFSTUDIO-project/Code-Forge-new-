import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { WorkspaceFile } from './workspace';

export async function syncWorkspaceToCloud(user: User, files: WorkspaceFile[]) {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .upsert({ user_id: user.id, name: 'My workspace', slug: 'my-workspace', updated_at: new Date().toISOString() }, { onConflict: 'user_id,slug' })
    .select('id')
    .single();
  if (projectError) throw projectError;

  // First upsert the current snapshot, then prune remote files deleted locally.
  const records = files.map((file) => ({
    project_id: project.id,
    user_id: user.id,
    path: file.path,
    name: file.name,
    content: file.content,
    updated_at: new Date().toISOString(),
  }));
  if (records.length) {
    const { error: filesError } = await supabase
      .from('project_files')
      .upsert(records, { onConflict: 'project_id,path' });
    if (filesError) throw filesError;
  }

  const { data: existing, error: existingError } = await supabase
    .from('project_files')
    .select('path')
    .eq('project_id', project.id)
    .eq('user_id', user.id);
  if (existingError) throw existingError;
  const currentPaths = new Set(files.map((file) => file.path));
  const stalePaths = (existing ?? []).map((row) => row.path).filter((path) => !currentPaths.has(path));
  for (const stalePath of stalePaths) {
    const { error } = await supabase
      .from('project_files')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .eq('path', stalePath);
    if (error) throw error;
  }

  return { projectId: project.id, count: records.length };
}

export async function loadWorkspaceFromCloud(user: User) {
  if (!supabase) return null;
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', user.id)
    .eq('slug', 'my-workspace')
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;

  const { data, error } = await supabase
    .from('project_files')
    .select('path,name,content')
    .eq('project_id', project.id)
    .order('path');
  if (error) throw error;
  if (!data?.length) return null;
  return data.map((file) => ({
    id: file.path,
    path: file.path,
    name: file.name,
    content: file.content,
  }));
}
