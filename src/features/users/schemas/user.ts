import * as z from 'zod';

export const userSchema = z.object({
  first_name: z.string().min(2, 'First name must be at least 2 characters'),
  last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(1, 'Phone number is required'),
  system_role: z.enum(['admin', 'user'], {
    message: 'Please select a system role'
  }),
  organization: z.enum(['wake', 'sans', 'ansan'], {
    message: 'Please select an organization'
  }),
  department: z.string().min(1, 'Please select a department'),
  org_role: z.enum(['owner', 'manager', 'member', 'viewer'], {
    message: 'Please select an organization role'
  }),
  invite_status: z.enum(['pending', 'accepted', 'expired'], {
    message: 'Please select an invite status'
  })
});

export type UserFormValues = z.infer<typeof userSchema>;
