import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://chtshwmxjlbfaaqwwudd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodHNod214amxiZmFhcXd3dWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxMjM4OTcsImV4cCI6MjA1MjY5OTg5N30.ZnTz3qpI_Mqa-lE9VGPOMkvc6TR7GoanO86lE_iD7sc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
