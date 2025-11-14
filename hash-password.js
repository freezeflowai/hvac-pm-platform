import bcrypt from 'bcryptjs';

const password = 'Samcor4gusto';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  console.log('Hashed password:', hash);
  process.exit(0);
});
