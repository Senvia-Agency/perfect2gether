import { open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
export async function acquireLock(filename = path.resolve('.messages.local.lock')) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(filename, 'wx');
      await handle.writeFile(String(process.pid)); await handle.close();
      return async () => { if (await readFile(filename, 'utf8').catch(() => '') === String(process.pid)) await unlink(filename); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const pid = Number(await readFile(filename, 'utf8'));
      let alive = true;
      try { process.kill(pid, 0); } catch (failure) { if (failure.code === 'ESRCH') alive = false; }
      if (alive || !Number.isSafeInteger(pid) || pid <= 0) throw new Error('O servidor local de mensagens já está aberto. Utilize http://127.0.0.1:8093/messages.');
      await unlink(filename);
    }
  }
  throw new Error('Não foi possível reservar a base local.');
}
