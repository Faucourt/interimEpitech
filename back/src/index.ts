import { createApp } from './app';
import { config } from './config';
import { createSupabaseUserRepository } from './users/supabaseRepository';

createApp(createSupabaseUserRepository()).listen(config.port, () => {
  console.log(`API démarrée sur http://localhost:${config.port}`);
});
