
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "capability_definitions": {
                  Row: {
                    "capability_key": string,"created_at": string,"description": string,"is_active": boolean
                  }
                  Insert: {
                    "capability_key": string,"created_at"?: string,"description": string,"is_active"?: boolean
                  }
                  Update: {
                    "capability_key"?: string,"created_at"?: string,"description"?: string,"is_active"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"character_roster_custom_field_values": {
                  Row: {
                    "character_id": string,"created_at": string,"created_by": string | null,"field_id": string,"guild_id": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "character_id": string,"created_at"?: string,"created_by"?: string | null,"field_id": string,"guild_id": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "character_id"?: string,"created_at"?: string,"created_by"?: string | null,"field_id"?: string,"guild_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "character_roster_custom_field_values_character_fk"
      columns: ["guild_id","character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "character_roster_custom_field_values_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "character_roster_custom_field_values_field_fk"
      columns: ["guild_id","field_id"]
isOneToOne: false
      referencedRelation: "roster_custom_fields"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "character_roster_custom_field_values_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"character_roster_profiles": {
                  Row: {
                    "character_id": string,"created_at": string,"created_by": string | null,"designation": string | null,"guild_id": string,"role_label": string | null,"updated_at": string
                  }
                  Insert: {
                    "character_id": string,"created_at"?: string,"created_by"?: string | null,"designation"?: string | null,"guild_id": string,"role_label"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "character_id"?: string,"created_at"?: string,"created_by"?: string | null,"designation"?: string | null,"guild_id"?: string,"role_label"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "character_roster_profiles_character_fk"
      columns: ["guild_id","character_id"]
isOneToOne: true
      referencedRelation: "characters"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "character_roster_profiles_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"character_roster_tags": {
                  Row: {
                    "character_id": string,"created_at": string,"created_by": string | null,"guild_id": string,"tag_id": string
                  }
                  Insert: {
                    "character_id": string,"created_at"?: string,"created_by"?: string | null,"guild_id": string,"tag_id": string
                  }
                  Update: {
                    "character_id"?: string,"created_at"?: string,"created_by"?: string | null,"guild_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "character_roster_tags_character_fk"
      columns: ["guild_id","character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "character_roster_tags_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "character_roster_tags_tag_fk"
      columns: ["guild_id","tag_id"]
isOneToOne: false
      referencedRelation: "roster_tags"
      referencedColumns: ["guild_id","id"]
    }
                  ]
                },"characters": {
                  Row: {
                    "class_name": string | null,"created_at": string,"created_by": string | null,"gear_score": number | null,"gender": string | null,"guild_id": string,"guild_position": string | null,"id": string,"ign": string,"inactive_reason": string | null,"left_guild_at": string | null,"level": number | null,"online_status": string | null,"rtnw_first_seen_at": string | null,"rtnw_last_seen_at": string | null,"source_origin": string,"status": string,"title": string | null,"total_contribution": number | null,"updated_at": string,"weekly_activity": number | null,"weekly_contribution": number | null
                  }
                  Insert: {
                    "class_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"gear_score"?: number | null,"gender"?: string | null,"guild_id": string,"guild_position"?: string | null,"id"?: string,"ign": string,"inactive_reason"?: string | null,"left_guild_at"?: string | null,"level"?: number | null,"online_status"?: string | null,"rtnw_first_seen_at"?: string | null,"rtnw_last_seen_at"?: string | null,"source_origin"?: string,"status"?: string,"title"?: string | null,"total_contribution"?: number | null,"updated_at"?: string,"weekly_activity"?: number | null,"weekly_contribution"?: number | null
                  }
                  Update: {
                    "class_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"gear_score"?: number | null,"gender"?: string | null,"guild_id"?: string,"guild_position"?: string | null,"id"?: string,"ign"?: string,"inactive_reason"?: string | null,"left_guild_at"?: string | null,"level"?: number | null,"online_status"?: string | null,"rtnw_first_seen_at"?: string | null,"rtnw_last_seen_at"?: string | null,"source_origin"?: string,"status"?: string,"title"?: string | null,"total_contribution"?: number | null,"updated_at"?: string,"weekly_activity"?: number | null,"weekly_contribution"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "characters_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "characters_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    }
                  ]
                },"guild_invite_acceptances": {
                  Row: {
                    "accepted_at": string,"accepted_role": string,"guild_id": string,"id": string,"invite_generation": number,"invite_id": string,"membership_id": string | null,"user_id": string | null
                  }
                  Insert: {
                    "accepted_at"?: string,"accepted_role": string,"guild_id": string,"id"?: string,"invite_generation": number,"invite_id": string,"membership_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string,"accepted_role"?: string,"guild_id"?: string,"id"?: string,"invite_generation"?: number,"invite_id"?: string,"membership_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "guild_invite_acceptances_invite_fk"
      columns: ["guild_id","invite_id"]
isOneToOne: false
      referencedRelation: "guild_invites"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "guild_invite_acceptances_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "guild_memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guild_invite_acceptances_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"guild_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"generation": number,"guild_id": string,"id": string,"invite_kind": string,"last_used_at": string | null,"max_uses": number | null,"revoked_at": string | null,"revoked_by": string | null,"role": string,"status": string,"token_digest": string,"updated_at": string,"use_count": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at": string,"generation"?: number,"guild_id": string,"id"?: string,"invite_kind": string,"last_used_at"?: string | null,"max_uses"?: number | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"role": string,"status"?: string,"token_digest": string,"updated_at"?: string,"use_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"generation"?: number,"guild_id"?: string,"id"?: string,"invite_kind"?: string,"last_used_at"?: string | null,"max_uses"?: number | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"role"?: string,"status"?: string,"token_digest"?: string,"updated_at"?: string,"use_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "guild_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guild_invites_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guild_invites_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"guild_memberships": {
                  Row: {
                    "created_at": string,"guild_id": string,"id": string,"joined_at": string,"role": string,"status": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"guild_id": string,"id"?: string,"joined_at"?: string,"role"?: string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"guild_id"?: string,"id"?: string,"joined_at"?: string,"role"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guild_memberships_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guild_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"guild_officer_capabilities": {
                  Row: {
                    "capability_key": string,"created_at": string,"granted_by": string | null,"guild_id": string,"membership_id": string
                  }
                  Insert: {
                    "capability_key": string,"created_at"?: string,"granted_by"?: string | null,"guild_id": string,"membership_id": string
                  }
                  Update: {
                    "capability_key"?: string,"created_at"?: string,"granted_by"?: string | null,"guild_id"?: string,"membership_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guild_officer_capabilities_capability_key_fkey"
      columns: ["capability_key"]
isOneToOne: false
      referencedRelation: "capability_definitions"
      referencedColumns: ["capability_key"]
    },{
      foreignKeyName: "guild_officer_capabilities_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guild_officer_capabilities_membership_fk"
      columns: ["guild_id","membership_id"]
isOneToOne: false
      referencedRelation: "guild_memberships"
      referencedColumns: ["guild_id","id"]
    }
                  ]
                },"guilds": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guilds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"id": string,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"roster_custom_fields": {
                  Row: {
                    "created_at": string,"created_by": string | null,"field_type": string,"guild_id": string,"id": string,"name": string,"select_options": (string)[],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"field_type": string,"guild_id": string,"id"?: string,"name": string,"select_options"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"field_type"?: string,"guild_id"?: string,"id"?: string,"name"?: string,"select_options"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_custom_fields_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roster_custom_fields_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    }
                  ]
                },"roster_sync_runs": {
                  Row: {
                    "applied_at": string,"created_at": string,"created_count": number,"guild_id": string,"id": string,"imported_by": string | null,"left_guild_count": number,"reactivated_count": number,"source_filename": string,"source_row_count": number,"source_sha256": string,"source_type": string,"unchanged_count": number,"updated_count": number
                  }
                  Insert: {
                    "applied_at"?: string,"created_at"?: string,"created_count"?: number,"guild_id": string,"id"?: string,"imported_by"?: string | null,"left_guild_count"?: number,"reactivated_count"?: number,"source_filename": string,"source_row_count": number,"source_sha256": string,"source_type"?: string,"unchanged_count"?: number,"updated_count"?: number
                  }
                  Update: {
                    "applied_at"?: string,"created_at"?: string,"created_count"?: number,"guild_id"?: string,"id"?: string,"imported_by"?: string | null,"left_guild_count"?: number,"reactivated_count"?: number,"source_filename"?: string,"source_row_count"?: number,"source_sha256"?: string,"source_type"?: string,"unchanged_count"?: number,"updated_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_sync_runs_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roster_sync_runs_imported_by_fkey"
      columns: ["imported_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"roster_tags": {
                  Row: {
                    "created_at": string,"created_by": string | null,"guild_id": string,"id": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"guild_id": string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"guild_id"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_tags_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roster_tags_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_guild_invite":
{ Args: { "p_generation": number,"p_token_digest": string }; Returns: string
                           },
"apply_generic_roster_import":
{ Args: { "p_guild_id": string,"p_mapped_fields": (string)[],"p_rows": Json,"p_source_filename": string,"p_source_sha256": string }; Returns: {
              "created_count": number,"source_row_count": number,"sync_run_id": string,"unchanged_count": number,"updated_count": number
            }[]
                           },
"apply_rtnw_roster_sync":
{ Args: { "p_guild_id": string,"p_rows": Json,"p_source_filename": string,"p_source_sha256": string }; Returns: {
              "created_count": number,"left_guild_count": number,"reactivated_count": number,"source_row_count": number,"sync_run_id": string,"unchanged_count": number,"updated_count": number
            }[]
                           },
"bulk_update_roster_characters":
{ Args: { "p_action": string,"p_character_ids": (string)[],"p_value": string }; Returns: number
                           },
"create_guild":
{ Args: { "p_name": string }; Returns: string
                           },
"create_guild_invite":
{ Args: { "p_expires_at": string,"p_guild_id": string,"p_invite_kind": string,"p_role": string,"p_token_digest": string }; Returns: string
                           },
"create_roster_character":
{ Args: { "p_class_name"?: string,"p_designation"?: string,"p_gear_score"?: number,"p_gender"?: string,"p_guild_id": string,"p_guild_position"?: string,"p_ign": string,"p_level"?: number,"p_online_status"?: string,"p_role_label"?: string,"p_title"?: string,"p_total_contribution"?: number,"p_weekly_activity"?: number,"p_weekly_contribution"?: number }; Returns: string
                           },
"create_roster_custom_field":
{ Args: { "p_field_type": string,"p_guild_id": string,"p_name": string,"p_select_options"?: (string)[] }; Returns: string
                           },
"create_roster_tag":
{ Args: { "p_guild_id": string,"p_name": string }; Returns: string
                           },
"delete_roster_custom_field":
{ Args: { "p_field_id": string }; Returns: undefined
                           },
"delete_roster_tag":
{ Args: { "p_tag_id": string }; Returns: undefined
                           },
"grant_officer_capability":
{ Args: { "p_capability_key": string,"p_membership_id": string }; Returns: undefined
                           },
"list_manageable_guild_invites":
{ Args: { "p_guild_id": string }; Returns: {
              "created_at": string,"expires_at": string,"generation": number,"invite_id": string,"invite_kind": string,"invite_role": string,"max_uses": number,"status": string,"updated_at": string,"use_count": number
            }[]
                           },
"preview_generic_roster_import":
{ Args: { "p_guild_id": string,"p_mapped_fields": (string)[],"p_rows": Json }; Returns: {
              "change_kind": string,"changed_fields": (string)[],"character_id": string,"ign": string
            }[]
                           },
"preview_rtnw_roster_sync":
{ Args: { "p_guild_id": string,"p_rows": Json }; Returns: {
              "change_kind": string,"character_id": string,"ign": string
            }[]
                           },
"regenerate_guild_invite":
{ Args: { "p_expires_at": string,"p_invite_id": string,"p_token_digest": string }; Returns: number
                           },
"rename_roster_tag":
{ Args: { "p_name": string,"p_tag_id": string }; Returns: undefined
                           },
"resolve_guild_invite":
{ Args: { "p_generation": number,"p_token_digest": string }; Returns: {
              "expires_at": string,"generation": number,"guild_id": string,"guild_name": string,"invite_id": string,"invite_kind": string,"invite_role": string
            }[]
                           },
"revoke_guild_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"revoke_officer_capability":
{ Args: { "p_capability_key": string,"p_membership_id": string }; Returns: undefined
                           },
"set_character_manual_status":
{ Args: { "p_character_id": string,"p_status": string }; Returns: undefined
                           },
"set_character_roster_custom_fields":
{ Args: { "p_character_id": string,"p_values": Json }; Returns: number
                           },
"set_character_roster_profile":
{ Args: { "p_character_id": string,"p_designation": string,"p_role_label": string }; Returns: undefined
                           },
"set_character_roster_tags":
{ Args: { "p_character_id": string,"p_tag_ids": (string)[] }; Returns: number
                           },
"set_guild_membership_role":
{ Args: { "p_membership_id": string,"p_role": string }; Returns: undefined
                           },
"set_guild_membership_status":
{ Args: { "p_membership_id": string,"p_status": string }; Returns: undefined
                           },
"transfer_guild_ownership":
{ Args: { "p_guild_id": string,"p_new_owner_membership_id": string }; Returns: undefined
                           },
"update_roster_character":
{ Args: { "p_character_id": string,"p_class_name": string,"p_gear_score": number,"p_gender": string,"p_guild_position": string,"p_ign": string,"p_level": number,"p_online_status": string,"p_title": string,"p_total_contribution": number,"p_weekly_activity": number,"p_weekly_contribution": number }; Returns: undefined
                           },
"update_roster_custom_field":
{ Args: { "p_field_id": string,"p_name": string,"p_select_options"?: (string)[] }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
