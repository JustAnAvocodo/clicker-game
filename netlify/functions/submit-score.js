const { Client } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { userId, score } = JSON.parse(event.body);
  const client = new Client(process.env.DATABASE_URL);

  try {
    await client.connect();

    // CHANGED: We removed "GREATEST"
    // Now it simply overwrites the old score with the new one
    const query = `
      INSERT INTO leaderboard (user_id, score)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET score = EXCLUDED.score, updated_at = NOW();
    `;

    await client.query(query, [userId, score]);

    return { statusCode: 200, body: JSON.stringify({ message: "Score updated" }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally {
    await client.end();
  }
};
