import mongoose from 'mongoose';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { User } from '../../../models/User';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.SECRET,
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'text@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password || '';
        if (!email || !password) return null;

        await dbConnect();

        // Use lean for speed; contains role and admin
        const user = await User.findOne({ email }).lean();
        if (!user || !user.password) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          admin: !!user.admin,
          role: user.role || 'customer',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          address: user.address || '',
          phone: user.phone || '',
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.admin = user.admin ?? false;
        token.role = user.role || 'customer';
        token.firstName = user.firstName || '';
        token.lastName = user.lastName || '';
        token.address = user.address || '';
        token.phone = user.phone || '';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.admin = token.admin ?? false;
        session.user.role = token.role || 'customer';
        session.user.firstName = token.firstName || '';
        session.user.lastName = token.lastName || '';
        session.user.address = token.address || '';
        session.user.phone = token.phone || '';
        session.user.name =
          (session.user.firstName && session.user.lastName)
            ? `${session.user.firstName} ${session.user.lastName}`
            : session.user.name || session.user.email || '';
      }
      return session;
    },
  },
};
