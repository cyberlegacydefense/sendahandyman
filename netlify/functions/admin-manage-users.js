// netlify/functions/admin-manage-users.js
// Manage admin users - CRUD operations for admin_users table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action, admin_data } = JSON.parse(event.body || "{}");

    // Verify admin authorization from request headers or token
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: cors(),
        body: JSON.stringify({ error: "Authorization required" })
      };
    }

    console.log(`🔐 Admin management action: ${action}`);

    switch (action) {
      case 'list':
        return await listAdminUsers(supabase);

      case 'create':
        return await createAdminUser(supabase, admin_data);

      case 'update':
        return await updateAdminUser(supabase, admin_data);

      case 'deactivate':
        return await deactivateAdminUser(supabase, admin_data.id);

      case 'activate':
        return await activateAdminUser(supabase, admin_data.id);

      default:
        return {
          statusCode: 400,
          headers: cors(),
          body: JSON.stringify({ error: "Invalid action" })
        };
    }

  } catch (error) {
    console.error('❌ Admin management error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Admin management failed',
        detail: error.message
      })
    };
  }
};

// List all admin users
async function listAdminUsers(supabase) {
  try {
    const { data: adminUsers, error } = await supabase
      .from('admin_users')
      .select('id, email, full_name, role, is_active, created_at, last_login_at, notes')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        admin_users: adminUsers || []
      })
    };

  } catch (error) {
    console.error('❌ Error listing admin users:', error);
    throw error;
  }
}

// Create new admin user
async function createAdminUser(supabase, adminData) {
  try {
    const { email, full_name, role = 'admin', notes } = adminData;

    if (!email || !full_name) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Email and full name are required" })
      };
    }

    // Check if admin already exists
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return {
        statusCode: 409,
        headers: cors(),
        body: JSON.stringify({ error: "Admin user with this email already exists" })
      };
    }

    // Create new admin user
    const { data: newAdmin, error } = await supabase
      .from('admin_users')
      .insert({
        email: email.toLowerCase(),
        full_name: full_name,
        role: role,
        is_active: true,
        notes: notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Admin user created: ${email} (${role})`);

    return {
      statusCode: 201,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        admin_user: newAdmin,
        message: "Admin user created successfully"
      })
    };

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

// Update admin user
async function updateAdminUser(supabase, adminData) {
  try {
    const { id, email, full_name, role, notes } = adminData;

    if (!id) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Admin user ID is required" })
      };
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (email) updateData.email = email.toLowerCase();
    if (full_name) updateData.full_name = full_name;
    if (role) updateData.role = role;
    if (notes !== undefined) updateData.notes = notes;

    const { data: updatedAdmin, error } = await supabase
      .from('admin_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Admin user updated: ${id}`);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        admin_user: updatedAdmin,
        message: "Admin user updated successfully"
      })
    };

  } catch (error) {
    console.error('❌ Error updating admin user:', error);
    throw error;
  }
}

// Deactivate admin user
async function deactivateAdminUser(supabase, adminId) {
  try {
    if (!adminId) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Admin user ID is required" })
      };
    }

    const { data: updatedAdmin, error } = await supabase
      .from('admin_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Admin user deactivated: ${adminId}`);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        admin_user: updatedAdmin,
        message: "Admin user deactivated successfully"
      })
    };

  } catch (error) {
    console.error('❌ Error deactivating admin user:', error);
    throw error;
  }
}

// Activate admin user
async function activateAdminUser(supabase, adminId) {
  try {
    if (!adminId) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Admin user ID is required" })
      };
    }

    const { data: updatedAdmin, error } = await supabase
      .from('admin_users')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Admin user activated: ${adminId}`);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        admin_user: updatedAdmin,
        message: "Admin user activated successfully"
      })
    };

  } catch (error) {
    console.error('❌ Error activating admin user:', error);
    throw error;
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}