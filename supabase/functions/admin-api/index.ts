// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This serves as an authoritative Supabase Edge Function for Talabat Al-Bayt Super Admin Operations.
// It verifies the Authorization header, validates admin privileges against public.admin_users,
// and securely executes privileged mutations without exposing service keys to frontend clients.

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

interface AdminActionRequest {
  action: string;
  payload?: any;
}

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({ error: "Supabase backend environment is not configured.", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Authenticate the caller using their JWT
    const jwt = authHeader.replace("Bearer ", "").trim();
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: supabaseAnonKey || supabaseServiceKey,
      },
    });

    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session token", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callingUser = await userRes.json();
    const callerId = callingUser?.id;

    if (!callerId) {
      return new Response(
        JSON.stringify({ error: "User identity could not be verified", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify Admin Status in database
    const adminCheckRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&is_active=eq.true&select=*`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey || jwt}`,
          apikey: supabaseServiceKey || supabaseAnonKey,
        },
      }
    );

    const adminRecords = await adminCheckRes.json();
    const adminRecord = Array.isArray(adminRecords) && adminRecords.length > 0 ? adminRecords[0] : null;

    if (!adminRecord) {
      return new Response(
        JSON.stringify({
          error: "Access Denied: Current user does not possess administrative privileges.",
          success: false,
          code: "FORBIDDEN_NOT_ADMIN",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse request body
    const body: AdminActionRequest = await req.json();
    const { action, payload } = body;

    // Helper: Log Admin Audit
    const logAudit = async (act: string, entityType: string, entityId: string, details: any) => {
      try {
        await fetch(`${supabaseUrl}/rest/v1/admin_audit_logs`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey || jwt}`,
            apikey: supabaseServiceKey || supabaseAnonKey,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            admin_user_id: callerId,
            admin_email: adminRecord.email || callingUser.email,
            action: act,
            entity_type: entityType,
            entity_id: entityId,
            details: details || {},
            created_at: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.warn("Audit logging failed:", e);
      }
    };

    // 5. Handle Privileged Actions
    switch (action) {
      // -------------------------------------------------------------
      // ACTION: check-admin-role
      // -------------------------------------------------------------
      case "check-admin-role": {
        return new Response(
          JSON.stringify({
            success: true,
            admin: adminRecord,
            user: callingUser,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: block-user
      // -------------------------------------------------------------
      case "block-user": {
        const { targetUserId, reason } = payload || {};
        if (!targetUserId) {
          return new Response(
            JSON.stringify({ error: "targetUserId is required", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey || jwt}`,
              apikey: supabaseServiceKey || supabaseAnonKey,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              is_blocked: true,
              blocked_reason: reason || "مخالفة شروط الاستخدام",
              blocked_at: new Date().toISOString(),
              blocked_by: callerId,
              updated_at: new Date().toISOString(),
            }),
          }
        );

        if (!updateRes.ok) {
          const errBody = await updateRes.text();
          return new Response(
            JSON.stringify({ error: "Failed to block user: " + errBody, success: false }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAudit("USER_BLOCKED", "USER", targetUserId, { reason });

        return new Response(
          JSON.stringify({ success: true, message: "تم حظر الحساب بنجاح", targetUserId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: unblock-user
      // -------------------------------------------------------------
      case "unblock-user": {
        const { targetUserId } = payload || {};
        if (!targetUserId) {
          return new Response(
            JSON.stringify({ error: "targetUserId is required", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey || jwt}`,
              apikey: supabaseServiceKey || supabaseAnonKey,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              is_blocked: false,
              blocked_reason: null,
              blocked_at: null,
              blocked_by: null,
              updated_at: new Date().toISOString(),
            }),
          }
        );

        if (!updateRes.ok) {
          const errBody = await updateRes.text();
          return new Response(
            JSON.stringify({ error: "Failed to unblock user: " + errBody, success: false }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAudit("USER_UNBLOCKED", "USER", targetUserId, {});

        return new Response(
          JSON.stringify({ success: true, message: "تم إلغاء حظر الحساب بنجاح", targetUserId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: delete-user (Safe Deletion with Confirmation)
      // -------------------------------------------------------------
      case "delete-user": {
        const { targetUserId, confirmation } = payload || {};
        if (!targetUserId || confirmation !== "DELETE") {
          return new Response(
            JSON.stringify({ error: "Confirmation word DELETE is required for account deletion", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (adminRecord.role !== "SUPER_ADMIN" && adminRecord.role !== "ADMIN") {
          return new Response(
            JSON.stringify({ error: "Only Administrators can perform account deletions.", success: false }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAudit("USER_DELETED", "USER", targetUserId, { deletedBy: callerId });

        // Delete from DB
        await fetch(`${supabaseUrl}/rest/v1/admin_users?user_id=eq.${targetUserId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey || jwt}`,
            apikey: supabaseServiceKey || supabaseAnonKey,
          },
        });
        await fetch(`${supabaseUrl}/rest/v1/household_members?user_id=eq.${targetUserId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey || jwt}`,
            apikey: supabaseServiceKey || supabaseAnonKey,
          },
        });
        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey || jwt}`,
            apikey: supabaseServiceKey || supabaseAnonKey,
          },
        });

        // Delete auth user via Admin Auth API if service role key is present
        let authDeleted = false;
        if (supabaseServiceKey) {
          try {
            const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                apikey: supabaseServiceKey,
              },
            });
            authDeleted = authRes.ok;
          } catch (e) {
            console.warn("Could not delete from auth.users table:", e);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            authDeleted,
            message: authDeleted
              ? "تم حذف الحساب نهائياً من قاعدة البيانات ونظام المصادقة"
              : "تم حذف سجل الحساب من قاعدة البيانات (حذف auth.users يتطلب SUPABASE_SERVICE_ROLE_KEY)",
            targetUserId,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: send-broadcast-notification
      // -------------------------------------------------------------
      case "send-broadcast-notification": {
        const {
          title,
          body,
          message,
          type,
          icon_name = null,
          image_url = null,
          action_type = null,
          action_route = null,
          is_active = true,
          start_at = null,
          end_at = null,
        } = payload || {};
        const finalBody = body || message;
        if (!title || !finalBody) {
          return new Response(
            JSON.stringify({ error: "Title and body are required.", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const nowIso = new Date().toISOString();
        const validType = ["top_banner", "modal", "bottom_banner"].includes(type) ? type : "top_banner";

        // Insert into central admin_notifications
        const notifRes = await fetch(`${supabaseUrl}/rest/v1/admin_notifications`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey || jwt}`,
            apikey: supabaseServiceKey || supabaseAnonKey,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            title,
            body: finalBody,
            type: validType,
            icon_name,
            image_url,
            action_type,
            action_route,
            is_active,
            start_at: start_at || nowIso,
            end_at: end_at || null,
            created_by: callerId,
            created_at: nowIso,
            updated_at: nowIso,
          }),
        });

        if (!notifRes.ok) {
          const errText = await notifRes.text();
          return new Response(
            JSON.stringify({ error: "Failed to create notification: " + errText, success: false }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAudit("NOTIFICATION_SENT", "NOTIFICATION", "broadcast", { title, type: validType });

        return new Response(
          JSON.stringify({ success: true, message: "تم إرسال الإشعار بنجاح" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: update-system-setting
      // -------------------------------------------------------------
      case "update-system-setting": {
        const { key, value } = payload || {};
        if (!key) {
          return new Response(
            JSON.stringify({ error: "Setting key is required", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await fetch(`${supabaseUrl}/rest/v1/app_system_settings`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey || jwt}`,
            apikey: supabaseServiceKey || supabaseAnonKey,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            key,
            value,
            updated_by: callerId,
            updated_at: new Date().toISOString(),
          }),
        });

        await logAudit("SETTINGS_CHANGED", "SETTINGS", key, { value });

        return new Response(
          JSON.stringify({ success: true, message: "تم حفظ الإعداد بنجاح", key }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: update-delivery-governorate
      // -------------------------------------------------------------
      case "update-delivery-governorate": {
        const { id, governorate_code, updates } = payload || {};
        if (!id && !governorate_code) {
          return new Response(
            JSON.stringify({ error: "Governorate id or governorate_code is required", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updatePayload: any = {
          updated_at: new Date().toISOString(),
        };
        if (updates?.delivery_fee !== undefined) updatePayload.delivery_fee = Number(updates.delivery_fee);
        if (updates?.is_active !== undefined) updatePayload.is_active = Boolean(updates.is_active);
        if (updates?.estimated_delivery_time !== undefined) updatePayload.estimated_delivery_time = updates.estimated_delivery_time;
        if (updates?.notes !== undefined) updatePayload.notes = updates.notes;
        if (updates?.governorate_name !== undefined) updatePayload.governorate_name = updates.governorate_name;

        const filterQuery = id ? `id=eq.${id}` : `governorate_code=eq.${encodeURIComponent(governorate_code)}`;

        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/delivery_governorate_settings?${filterQuery}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey || jwt}`,
              apikey: supabaseServiceKey || supabaseAnonKey,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(updatePayload),
          }
        );

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          return new Response(
            JSON.stringify({ error: "Failed to update governorate: " + errText, success: false }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updatedRows = await updateRes.json();
        await logAudit("DELIVERY_GOVERNORATE_UPDATED", "DELIVERY_GOVERNORATE", id || governorate_code, {
          updates: updatePayload,
          updatedRowsCount: Array.isArray(updatedRows) ? updatedRows.length : 1,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "تم تحديث إعدادات المحافظة بنجاح",
            data: Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : updatePayload,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: add-delivery-governorate
      // -------------------------------------------------------------
      case "add-delivery-governorate": {
        const { setting } = payload || {};
        if (!setting?.governorate_code || !setting?.governorate_name) {
          return new Response(
            JSON.stringify({ error: "Governorate code and name are required", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const newRow = {
          governorate_code: setting.governorate_code.trim().toUpperCase(),
          governorate_name: setting.governorate_name.trim(),
          delivery_fee: Number(setting.delivery_fee || 0),
          is_active: setting.is_active !== undefined ? Boolean(setting.is_active) : true,
          estimated_delivery_time: setting.estimated_delivery_time?.trim() || null,
          notes: setting.notes?.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const insertRes = await fetch(
          `${supabaseUrl}/rest/v1/delivery_governorate_settings`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey || jwt}`,
              apikey: supabaseServiceKey || supabaseAnonKey,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(newRow),
          }
        );

        if (!insertRes.ok) {
          const errText = await insertRes.text();
          return new Response(
            JSON.stringify({ error: "Failed to add governorate: " + errText, success: false }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const insertedRows = await insertRes.json();
        const createdGov = Array.isArray(insertedRows) && insertedRows.length > 0 ? insertedRows[0] : newRow;

        await logAudit("DELIVERY_GOVERNORATE_ADDED", "DELIVERY_GOVERNORATE", createdGov.id || newRow.governorate_code, newRow);

        return new Response(
          JSON.stringify({ success: true, message: "تمت إضافة المحافظة بنجاح", data: createdGov }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: toggle-delivery-governorate
      // -------------------------------------------------------------
      case "toggle-delivery-governorate": {
        const { id, governorate_code, is_active } = payload || {};
        if (!id && !governorate_code) {
          return new Response(
            JSON.stringify({ error: "Governorate id or governorate_code is required", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const filterQuery = id ? `id=eq.${id}` : `governorate_code=eq.${encodeURIComponent(governorate_code)}`;

        const patchRes = await fetch(
          `${supabaseUrl}/rest/v1/delivery_governorate_settings?${filterQuery}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey || jwt}`,
              apikey: supabaseServiceKey || supabaseAnonKey,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              is_active: Boolean(is_active),
              updated_at: new Date().toISOString(),
            }),
          }
        );

        if (!patchRes.ok) {
          const errText = await patchRes.text();
          return new Response(
            JSON.stringify({ error: "Failed to toggle governorate: " + errText, success: false }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAudit("DELIVERY_GOVERNORATE_TOGGLED", "DELIVERY_GOVERNORATE", id || governorate_code, { is_active });

        return new Response(
          JSON.stringify({ success: true, message: "تم تغيير حالة المحافظة بنجاح" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -------------------------------------------------------------
      // ACTION: delete-delivery-governorate
      // -------------------------------------------------------------
      case "delete-delivery-governorate": {
        const { id } = payload || {};
        if (!id) {
          return new Response(
            JSON.stringify({ error: "Governorate id is required", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const deleteRes = await fetch(
          `${supabaseUrl}/rest/v1/delivery_governorate_settings?id=eq.${id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey || jwt}`,
              apikey: supabaseServiceKey || supabaseAnonKey,
            },
          }
        );

        if (!deleteRes.ok) {
          const errText = await deleteRes.text();
          return new Response(
            JSON.stringify({ error: "Failed to delete governorate: " + errText, success: false }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAudit("DELIVERY_GOVERNORATE_DELETED", "DELIVERY_GOVERNORATE", id, {});

        return new Response(
          JSON.stringify({ success: true, message: "تم حذف إعدادات المحافظة بنجاح" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}`, success: false }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: any) {
    console.error("Admin Edge Function unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error in Admin Edge Function", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
