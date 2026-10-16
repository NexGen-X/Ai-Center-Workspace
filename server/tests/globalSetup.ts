export async function setup() {
  const { initializeDatabase } = await import('../src/db/index.js');
  await initializeDatabase();
}
