const { app } = require('electron');

app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3');
    const database = new Database(':memory:');
    database.exec('CREATE TABLE smoke_test (value INTEGER NOT NULL)');
    database.prepare('INSERT INTO smoke_test (value) VALUES (?)').run(1);
    const result = database.prepare('SELECT value FROM smoke_test').get();
    database.close();
    if (result.value !== 1) throw new Error('Electron SQLite verification returned an unexpected result.');
    console.log('better-sqlite3 loaded and executed under Electron.');
    app.exit(0);
  } catch (error) {
    console.error('Electron SQLite verification failed.', error);
    app.exit(1);
  }
});
