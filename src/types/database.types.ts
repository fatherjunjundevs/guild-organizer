
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_guild":
{ Args: { "p_name": string }; Returns: string
                           },
"grant_officer_capability":
{ Args: { "p_capability_key": string,"p_membership_id": string }; Returns: undefined
                           },
"revoke_officer_capability":
{ Args: { "p_capability_key": string,"p_membership_id": string }; Returns: undefined
                           },
"set_guild_membership_role":
{ Args: { "p_membership_id": string,"p_role": string }; Returns: undefined
                           },
"set_guild_membership_status":
{ Args: { "p_membership_id": string,"p_status": string }; Returns: undefined
                           },
"transfer_guild_ownership":
{ Args: { "p_guild_id": string,"p_new_owner_membership_id": string }; Returns: undefined
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
