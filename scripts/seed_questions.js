/**
 * Seed Script — Bulk-insert aptitude questions into Supabase
 * Usage: node scripts/seed_questions.js
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const SUPABASE_URL = 'https://zkmtpphhyltvoylrsyxd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbXRwcGhoeWx0dm95bHJzeXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDg2OTMsImV4cCI6MjA4Nzg4NDY5M30.Lw9q64nx6bGBXWpB07E58UXyMK5BEsII8VkDPdAopZQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const questionsDir = path.join(__dirname, 'questions');
    const files = fs.readdirSync(questionsDir).filter(f => f.endsWith('.json'));

    let totalInserted = 0;

    for (const file of files) {
        const filePath = path.join(questionsDir, file);
        const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const categoryName = path.basename(file, '.json');

        console.log(`\nInserting ${questions.length} questions from ${categoryName}...`);

        // Insert in batches of 25 to avoid payload limits
        for (let i = 0; i < questions.length; i += 25) {
            const batch = questions.slice(i, i + 25);
            const { data, error } = await supabase.from('problems').insert(batch).select('id');

            if (error) {
                console.error(`  ✗ Batch ${Math.floor(i / 25) + 1} failed:`, error.message);
            } else {
                console.log(`  ✓ Inserted batch ${Math.floor(i / 25) + 1} (${data.length} rows)`);
                totalInserted += data.length;
            }
        }
    }

    // Print summary
    const { count } = await supabase.from('problems').select('*', { count: 'exact', head: true });
    console.log(`\n========================================`);
    console.log(`✓ Done! Inserted ${totalInserted} new questions.`);
    console.log(`  Total problems in DB: ${count}`);
    console.log(`========================================\n`);
}

main().catch(console.error);
