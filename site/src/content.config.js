// The Games: one TOML file per Game in ../games/library/ (see its README). The file name is
// the slug. A file that doesn't match the schema fails the build.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const games = defineCollection({
  loader: glob({
    pattern: '*.toml',
    base: '../games/library',
    // Keep the file name as it is (the default loader slugifies it).
    generateId: ({ entry }) => entry.replace(/\.toml$/, ''),
  }),
  schema: z
    .object({
      name: z.string().min(1),
      command: z.string().min(1),
      description: z.string().min(1),
      displayed: z.boolean().default(false),
      refresh_code: z.number().int().optional(),
    })
    .strict(),
});

export const collections = { games };
