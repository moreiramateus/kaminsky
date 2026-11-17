const {spawnSync}=require('node:child_process');
if(!process.env.DATABASE_URL)throw new Error('Configure DATABASE_URL.');
const r=spawnSync(process.execPath,['--test','test/postgres.test.cjs'],{stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:process.env.DATABASE_URL}});
process.exitCode=r.status??1;
