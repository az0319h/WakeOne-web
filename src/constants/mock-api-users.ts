////////////////////////////////////////////////////////////////////////////////
// 🛑 Nothing in here has anything to do with Nextjs, it's just a fake database
////////////////////////////////////////////////////////////////////////////////

import { faker } from '@faker-js/faker';
import { matchSorter } from 'match-sorter';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  system_role: 'admin' | 'user';
  organization: 'wake' | 'sans' | 'ansan';
  department: string;
  org_role: 'owner' | 'manager' | 'member' | 'viewer';
  invite_status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  updated_at: string;
};

// Mock user data store
export const fakeUsers = {
  records: [] as User[],

  initialize() {
    const sampleUsers: User[] = [];
    function generateRandomUserData(id: number): User {
      const systemRoles: Array<User['system_role']> = ['admin', 'user'];
      const organizations: Array<User['organization']> = ['wake', 'sans', 'ansan'];
      const orgRoles: Array<User['org_role']> = ['owner', 'manager', 'member', 'viewer'];
      const inviteStatuses: Array<User['invite_status']> = ['pending', 'accepted', 'expired'];

      const departmentsByOrganization: Record<User['organization'], string[]> = {
        wake: [
          'content',
          'business-planning',
          'marketing',
          'design',
          'procurement-logistics',
          'hr',
          'accounting'
        ],
        sans: ['ikseon-main', 'shinsegae-gangnam-sweetpark'],
        ansan: ['production', 'quality', 'engineering', 'support', 'logistics']
      };

      const organization = faker.helpers.arrayElement(organizations);
      const department = faker.helpers.arrayElement(departmentsByOrganization[organization]);

      return {
        id,
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        email: faker.internet.email(),
        phone: faker.phone.number({ style: 'national' }),
        system_role: faker.helpers.arrayElement(systemRoles),
        organization,
        department,
        org_role: faker.helpers.arrayElement(orgRoles),
        invite_status: faker.helpers.arrayElement(inviteStatuses),
        created_at: faker.date.between({ from: '2022-01-01', to: '2023-12-31' }).toISOString(),
        updated_at: faker.date.recent().toISOString()
      };
    }

    for (let i = 1; i <= 50; i++) {
      sampleUsers.push(generateRandomUserData(i));
    }

    this.records = sampleUsers;
  },

  async getAll({
    systemRoles = [],
    organizations = [],
    departments = [],
    orgRoles = [],
    search
  }: {
    systemRoles?: string[];
    organizations?: string[];
    departments?: string[];
    orgRoles?: string[];
    search?: string;
  }) {
    let users = [...this.records];

    if (systemRoles.length > 0) {
      users = users.filter((user) => systemRoles.includes(user.system_role));
    }

    if (organizations.length > 0) {
      users = users.filter((user) => organizations.includes(user.organization));
    }

    if (departments.length > 0) {
      users = users.filter((user) => departments.includes(user.department));
    }

    if (orgRoles.length > 0) {
      users = users.filter((user) => orgRoles.includes(user.org_role));
    }

    if (search) {
      users = matchSorter(users, search, {
        keys: ['first_name', 'last_name', 'email', 'organization', 'department']
      });
    }

    return users;
  },

  async createUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>) {
    await delay(800);

    const newUser: User = {
      ...data,
      id: this.records.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.records.push(newUser);

    return {
      success: true,
      message: 'User created successfully',
      user: newUser
    };
  },

  async updateUser(id: number, data: Omit<User, 'id' | 'created_at' | 'updated_at'>) {
    await delay(800);

    const index = this.records.findIndex((user) => user.id === id);

    if (index === -1) {
      return { success: false, message: `User with ID ${id} not found` };
    }

    this.records[index] = {
      ...this.records[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    return {
      success: true,
      message: 'User updated successfully',
      user: this.records[index]
    };
  },

  async deleteUser(id: number) {
    await delay(800);

    const index = this.records.findIndex((user) => user.id === id);

    if (index === -1) {
      return { success: false, message: `User with ID ${id} not found` };
    }

    this.records.splice(index, 1);

    return {
      success: true,
      message: 'User deleted successfully'
    };
  },

  async getUsers({
    page = 1,
    limit = 10,
    systemRoles,
    organizations,
    departments,
    orgRoles,
    search,
    sort
  }: {
    page?: number;
    limit?: number;
    systemRoles?: string | string[];
    organizations?: string | string[];
    departments?: string | string[];
    orgRoles?: string | string[];
    search?: string;
    sort?: string;
  }) {
    await delay(800);
    const systemRolesArray = systemRoles
      ? Array.isArray(systemRoles)
        ? systemRoles
        : String(systemRoles).split(/[.,]/)
      : [];
    const organizationsArray = organizations
      ? Array.isArray(organizations)
        ? organizations
        : String(organizations).split(/[.,]/)
      : [];
    const departmentsArray = departments
      ? Array.isArray(departments)
        ? departments
        : String(departments).split(/[.,]/)
      : [];
    const orgRolesArray = orgRoles
      ? Array.isArray(orgRoles)
        ? orgRoles
        : String(orgRoles).split(/[.,]/)
      : [];

    const allUsers = await this.getAll({
      systemRoles: systemRolesArray,
      organizations: organizationsArray,
      departments: departmentsArray,
      orgRoles: orgRolesArray,
      search
    });

    // Sorting
    if (sort) {
      try {
        const sortItems = JSON.parse(sort) as {
          id: string;
          desc: boolean;
        }[];
        if (sortItems.length > 0) {
          const { id, desc } = sortItems[0];
          allUsers.sort((a, b) => {
            // Handle computed 'name' column
            const aVal =
              id === 'name' ? `${a.first_name} ${a.last_name}` : (a as Record<string, unknown>)[id];
            const bVal =
              id === 'name' ? `${b.first_name} ${b.last_name}` : (b as Record<string, unknown>)[id];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              return desc ? bVal - aVal : aVal - bVal;
            }
            const aStr = String(aVal ?? '').toLowerCase();
            const bStr = String(bVal ?? '').toLowerCase();
            return desc ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
          });
        }
      } catch {
        // Invalid sort param — ignore
      }
    }

    const totalUsers = allUsers.length;

    const offset = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Sample data for testing and learning purposes',
      total_users: totalUsers,
      offset,
      limit,
      users: paginatedUsers
    };
  }
};

fakeUsers.initialize();
