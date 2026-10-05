
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
                },"character_reconciliations": {
                  Row: {
                    "guild_id": string,"id": string,"note": string | null,"reconciled_at": string,"reconciled_by": string | null,"source_character_id": string,"source_ign_snapshot": string,"target_character_id": string,"target_ign_snapshot": string,"triggering_sync_run_id": string | null
                  }
                  Insert: {
                    "guild_id": string,"id"?: string,"note"?: string | null,"reconciled_at"?: string,"reconciled_by"?: string | null,"source_character_id": string,"source_ign_snapshot": string,"target_character_id": string,"target_ign_snapshot": string,"triggering_sync_run_id"?: string | null
                  }
                  Update: {
                    "guild_id"?: string,"id"?: string,"note"?: string | null,"reconciled_at"?: string,"reconciled_by"?: string | null,"source_character_id"?: string,"source_ign_snapshot"?: string,"target_character_id"?: string,"target_ign_snapshot"?: string,"triggering_sync_run_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "character_reconciliations_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "character_reconciliations_reconciled_by_fkey"
      columns: ["reconciled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "character_reconciliations_source_fk"
      columns: ["guild_id","source_character_id"]
isOneToOne: true
      referencedRelation: "characters"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "character_reconciliations_target_fk"
      columns: ["guild_id","target_character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "character_reconciliations_triggering_run_fk"
      columns: ["guild_id","triggering_sync_run_id"]
isOneToOne: false
      referencedRelation: "roster_sync_runs"
      referencedColumns: ["guild_id","id"]
    }
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
                    "class_name": string | null,"created_at": string,"created_by": string | null,"gear_score": number | null,"gender": string | null,"guild_id": string,"guild_position": string | null,"id": string,"ign": string,"inactive_reason": string | null,"left_guild_at": string | null,"level": number | null,"online_status": string | null,"reconciled_at": string | null,"reconciled_by": string | null,"reconciled_into_character_id": string | null,"rtnw_first_seen_at": string | null,"rtnw_last_seen_at": string | null,"source_origin": string,"status": string,"title": string | null,"total_contribution": number | null,"updated_at": string,"weekly_activity": number | null,"weekly_contribution": number | null
                  }
                  Insert: {
                    "class_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"gear_score"?: number | null,"gender"?: string | null,"guild_id": string,"guild_position"?: string | null,"id"?: string,"ign": string,"inactive_reason"?: string | null,"left_guild_at"?: string | null,"level"?: number | null,"online_status"?: string | null,"reconciled_at"?: string | null,"reconciled_by"?: string | null,"reconciled_into_character_id"?: string | null,"rtnw_first_seen_at"?: string | null,"rtnw_last_seen_at"?: string | null,"source_origin"?: string,"status"?: string,"title"?: string | null,"total_contribution"?: number | null,"updated_at"?: string,"weekly_activity"?: number | null,"weekly_contribution"?: number | null
                  }
                  Update: {
                    "class_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"gear_score"?: number | null,"gender"?: string | null,"guild_id"?: string,"guild_position"?: string | null,"id"?: string,"ign"?: string,"inactive_reason"?: string | null,"left_guild_at"?: string | null,"level"?: number | null,"online_status"?: string | null,"reconciled_at"?: string | null,"reconciled_by"?: string | null,"reconciled_into_character_id"?: string | null,"rtnw_first_seen_at"?: string | null,"rtnw_last_seen_at"?: string | null,"source_origin"?: string,"status"?: string,"title"?: string | null,"total_contribution"?: number | null,"updated_at"?: string,"weekly_activity"?: number | null,"weekly_contribution"?: number | null
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
    },{
      foreignKeyName: "characters_reconciled_by_fkey"
      columns: ["reconciled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "characters_reconciled_target_fk"
      columns: ["guild_id","reconciled_into_character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["guild_id","id"]
    }
                  ]
                },"event_areas": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string,"guild_id": string,"id": string,"name": string,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id": string,"guild_id": string,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string,"guild_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_areas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_areas_event_fk"
      columns: ["guild_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_areas_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_assignments": {
                  Row: {
                    "character_id": string,"created_at": string,"created_by": string | null,"event_id": string,"guild_id": string,"id": string,"slot_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "character_id": string,"created_at"?: string,"created_by"?: string | null,"event_id": string,"guild_id": string,"id"?: string,"slot_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "character_id"?: string,"created_at"?: string,"created_by"?: string | null,"event_id"?: string,"guild_id"?: string,"id"?: string,"slot_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_assignments_character_fk"
      columns: ["guild_id","character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_assignments_event_fk"
      columns: ["guild_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_assignments_slot_fk"
      columns: ["guild_id","event_id","slot_id"]
isOneToOne: true
      referencedRelation: "event_slots"
      referencedColumns: ["guild_id","event_id","id"]
    },{
      foreignKeyName: "event_assignments_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_parties": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string,"guild_id": string,"id": string,"name": string,"section_id": string,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id": string,"guild_id": string,"id"?: string,"name": string,"section_id": string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string,"guild_id"?: string,"id"?: string,"name"?: string,"section_id"?: string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_parties_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_parties_event_fk"
      columns: ["guild_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_parties_section_fk"
      columns: ["guild_id","event_id","section_id"]
isOneToOne: false
      referencedRelation: "event_sections"
      referencedColumns: ["guild_id","event_id","id"]
    },{
      foreignKeyName: "event_parties_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_sections": {
                  Row: {
                    "area_id": string | null,"created_at": string,"created_by": string | null,"event_id": string,"guild_id": string,"id": string,"name": string,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "area_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"event_id": string,"guild_id": string,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "area_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"event_id"?: string,"guild_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_sections_area_fk"
      columns: ["guild_id","event_id","area_id"]
isOneToOne: false
      referencedRelation: "event_areas"
      referencedColumns: ["guild_id","event_id","id"]
    },{
      foreignKeyName: "event_sections_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_sections_event_fk"
      columns: ["guild_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_sections_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_slots": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string,"guild_id": string,"id": string,"name": string,"party_id": string,"role_label": string | null,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id": string,"guild_id": string,"id"?: string,"name": string,"party_id": string,"role_label"?: string | null,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string,"guild_id"?: string,"id"?: string,"name"?: string,"party_id"?: string,"role_label"?: string | null,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_slots_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_slots_event_fk"
      columns: ["guild_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_slots_party_fk"
      columns: ["guild_id","event_id","party_id"]
isOneToOne: false
      referencedRelation: "event_parties"
      referencedColumns: ["guild_id","event_id","id"]
    },{
      foreignKeyName: "event_slots_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_template_areas": {
                  Row: {
                    "created_at": string,"created_by": string | null,"guild_id": string,"id": string,"name": string,"sort_order": number,"template_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"guild_id": string,"id"?: string,"name": string,"sort_order"?: number,"template_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"guild_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"template_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_template_areas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_template_areas_template_fk"
      columns: ["guild_id","template_id"]
isOneToOne: false
      referencedRelation: "event_templates"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_template_areas_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_template_parties": {
                  Row: {
                    "created_at": string,"created_by": string | null,"guild_id": string,"id": string,"name": string,"section_id": string,"sort_order": number,"template_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"guild_id": string,"id"?: string,"name": string,"section_id": string,"sort_order"?: number,"template_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"guild_id"?: string,"id"?: string,"name"?: string,"section_id"?: string,"sort_order"?: number,"template_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_template_parties_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_template_parties_section_fk"
      columns: ["guild_id","template_id","section_id"]
isOneToOne: false
      referencedRelation: "event_template_sections"
      referencedColumns: ["guild_id","template_id","id"]
    },{
      foreignKeyName: "event_template_parties_template_fk"
      columns: ["guild_id","template_id"]
isOneToOne: false
      referencedRelation: "event_templates"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_template_parties_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_template_sections": {
                  Row: {
                    "area_id": string | null,"created_at": string,"created_by": string | null,"guild_id": string,"id": string,"name": string,"sort_order": number,"template_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "area_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"guild_id": string,"id"?: string,"name": string,"sort_order"?: number,"template_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "area_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"guild_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"template_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_template_sections_area_fk"
      columns: ["guild_id","template_id","area_id"]
isOneToOne: false
      referencedRelation: "event_template_areas"
      referencedColumns: ["guild_id","template_id","id"]
    },{
      foreignKeyName: "event_template_sections_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_template_sections_template_fk"
      columns: ["guild_id","template_id"]
isOneToOne: false
      referencedRelation: "event_templates"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_template_sections_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_template_slots": {
                  Row: {
                    "created_at": string,"created_by": string | null,"guild_id": string,"id": string,"name": string,"party_id": string,"role_label": string | null,"sort_order": number,"template_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"guild_id": string,"id"?: string,"name": string,"party_id": string,"role_label"?: string | null,"sort_order"?: number,"template_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"guild_id"?: string,"id"?: string,"name"?: string,"party_id"?: string,"role_label"?: string | null,"sort_order"?: number,"template_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_template_slots_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_template_slots_party_fk"
      columns: ["guild_id","template_id","party_id"]
isOneToOne: false
      referencedRelation: "event_template_parties"
      referencedColumns: ["guild_id","template_id","id"]
    },{
      foreignKeyName: "event_template_slots_template_fk"
      columns: ["guild_id","template_id"]
isOneToOne: false
      referencedRelation: "event_templates"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_template_slots_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_templates": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"event_type_id": string,"guild_id": string,"id": string,"name": string,"status": string,"updated_at": string,"updated_by": string | null,"uses_areas": boolean
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"event_type_id": string,"guild_id": string,"id"?: string,"name": string,"status"?: string,"updated_at"?: string,"updated_by"?: string | null,"uses_areas"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"event_type_id"?: string,"guild_id"?: string,"id"?: string,"name"?: string,"status"?: string,"updated_at"?: string,"updated_by"?: string | null,"uses_areas"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_templates_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_templates_event_type_fk"
      columns: ["guild_id","event_type_id"]
isOneToOne: false
      referencedRelation: "event_types"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "event_templates_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_templates_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_types": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"guild_id": string,"id": string,"name": string,"status": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"guild_id": string,"id"?: string,"name": string,"status"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"guild_id"?: string,"id"?: string,"name"?: string,"status"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_types_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_types_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_types_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"event_type_id": string,"event_type_name_snapshot": string,"guild_id": string,"id": string,"name": string,"source_template_id": string,"status": string,"template_name_snapshot": string,"updated_at": string,"updated_by": string | null,"uses_areas": boolean
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"event_type_id": string,"event_type_name_snapshot": string,"guild_id": string,"id"?: string,"name": string,"source_template_id": string,"status"?: string,"template_name_snapshot": string,"updated_at"?: string,"updated_by"?: string | null,"uses_areas": boolean
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"event_type_id"?: string,"event_type_name_snapshot"?: string,"guild_id"?: string,"id"?: string,"name"?: string,"source_template_id"?: string,"status"?: string,"template_name_snapshot"?: string,"updated_at"?: string,"updated_by"?: string | null,"uses_areas"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_event_type_fk"
      columns: ["guild_id","event_type_id"]
isOneToOne: false
      referencedRelation: "event_types"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "events_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_source_template_fk"
      columns: ["guild_id","source_template_id"]
isOneToOne: false
      referencedRelation: "event_templates"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "events_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"roster_sync_run_changes": {
                  Row: {
                    "after_values": NonNullable<Json>,"before_values": NonNullable<Json>,"change_kind": string,"changed_fields": (string)[],"character_id": string,"character_ign": string,"guild_id": string,"id": string,"recorded_at": string,"sync_run_id": string
                  }
                  Insert: {
                    "after_values"?: NonNullable<Json>,"before_values"?: NonNullable<Json>,"change_kind": string,"changed_fields": (string)[],"character_id": string,"character_ign": string,"guild_id": string,"id"?: string,"recorded_at"?: string,"sync_run_id": string
                  }
                  Update: {
                    "after_values"?: NonNullable<Json>,"before_values"?: NonNullable<Json>,"change_kind"?: string,"changed_fields"?: (string)[],"character_id"?: string,"character_ign"?: string,"guild_id"?: string,"id"?: string,"recorded_at"?: string,"sync_run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_sync_run_changes_character_fk"
      columns: ["guild_id","character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["guild_id","id"]
    },{
      foreignKeyName: "roster_sync_run_changes_guild_id_fkey"
      columns: ["guild_id"]
isOneToOne: false
      referencedRelation: "guilds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roster_sync_run_changes_run_fk"
      columns: ["guild_id","sync_run_id"]
isOneToOne: false
      referencedRelation: "roster_sync_runs"
      referencedColumns: ["guild_id","id"]
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
"activate_event_template":
{ Args: { "p_template_id": string }; Returns: undefined
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
"clone_event_template":
{ Args: { "p_description"?: string,"p_event_type_id": string,"p_name": string,"p_source_template_id": string }; Returns: string
                           },
"create_event_from_template":
{ Args: { "p_description"?: string,"p_name": string,"p_template_id": string }; Returns: string
                           },
"create_event_template":
{ Args: { "p_description"?: string,"p_event_type_id": string,"p_guild_id": string,"p_name": string,"p_uses_areas"?: boolean }; Returns: string
                           },
"create_event_template_area":
{ Args: { "p_name": string,"p_sort_order"?: number,"p_template_id": string }; Returns: string
                           },
"create_event_template_party":
{ Args: { "p_name": string,"p_section_id": string,"p_sort_order"?: number }; Returns: string
                           },
"create_event_template_party_with_slots":
{ Args: { "p_seat_count"?: number,"p_section_id": string }; Returns: string
                           },
"create_event_template_section":
{ Args: { "p_area_id"?: string,"p_name": string,"p_sort_order"?: number,"p_template_id": string }; Returns: string
                           },
"create_event_template_slot":
{ Args: { "p_name": string,"p_party_id": string,"p_role_label"?: string,"p_sort_order"?: number }; Returns: string
                           },
"create_event_template_team":
{ Args: { "p_area_id"?: string,"p_name": string,"p_party_count"?: number,"p_seat_count"?: number,"p_template_id": string }; Returns: string
                           },
"create_event_type":
{ Args: { "p_description"?: string,"p_guild_id": string,"p_name": string }; Returns: string
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
"delete_event_template":
{ Args: { "p_template_id": string }; Returns: undefined
                           },
"delete_event_template_area":
{ Args: { "p_area_id": string }; Returns: undefined
                           },
"delete_event_template_party":
{ Args: { "p_party_id": string }; Returns: undefined
                           },
"delete_event_template_section":
{ Args: { "p_section_id": string }; Returns: undefined
                           },
"delete_event_template_slot":
{ Args: { "p_slot_id": string }; Returns: undefined
                           },
"delete_event_type":
{ Args: { "p_event_type_id": string }; Returns: undefined
                           },
"delete_roster_custom_field":
{ Args: { "p_field_id": string }; Returns: undefined
                           },
"delete_roster_tag":
{ Args: { "p_tag_id": string }; Returns: undefined
                           },
"get_event_template_preview":
{ Args: { "p_template_id": string }; Returns: {
              "area_id": string,"area_name": string,"area_sort_order": number,"event_type_id": string,"event_type_name": string,"party_id": string,"party_name": string,"party_sort_order": number,"role_label": string,"section_id": string,"section_name": string,"section_sort_order": number,"slot_id": string,"slot_name": string,"slot_sort_order": number,"template_description": string,"template_id": string,"template_name": string,"template_status": string,"uses_areas": boolean
            }[]
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
"reconcile_roster_character":
{ Args: { "p_note"?: string,"p_source_character_id": string,"p_target_character_id": string,"p_triggering_sync_run_id"?: string }; Returns: string
                           },
"regenerate_guild_invite":
{ Args: { "p_expires_at": string,"p_invite_id": string,"p_token_digest": string }; Returns: number
                           },
"rename_roster_tag":
{ Args: { "p_name": string,"p_tag_id": string }; Returns: undefined
                           },
"reorder_event_template_parties":
{ Args: { "p_ordered_party_ids": (string)[],"p_section_id": string }; Returns: undefined
                           },
"reorder_event_template_teams":
{ Args: { "p_area_id": string,"p_ordered_section_ids": (string)[],"p_template_id": string }; Returns: undefined
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
"update_event_template":
{ Args: { "p_description": string,"p_event_type_id": string,"p_name": string,"p_status": string,"p_template_id": string,"p_uses_areas": boolean }; Returns: undefined
                           },
"update_event_template_area":
{ Args: { "p_area_id": string,"p_name": string,"p_sort_order": number }; Returns: undefined
                           },
"update_event_template_party":
{ Args: { "p_name": string,"p_party_id": string,"p_section_id": string,"p_sort_order": number }; Returns: undefined
                           },
"update_event_template_party_layout":
{ Args: { "p_allow_role_removal"?: boolean,"p_name": string,"p_party_id": string,"p_seat_count": number,"p_sort_order": number }; Returns: undefined
                           },
"update_event_template_section":
{ Args: { "p_area_id": string,"p_name": string,"p_section_id": string,"p_sort_order": number }; Returns: undefined
                           },
"update_event_template_slot":
{ Args: { "p_name": string,"p_party_id": string,"p_role_label": string,"p_slot_id": string,"p_sort_order": number }; Returns: undefined
                           },
"update_event_type":
{ Args: { "p_description": string,"p_event_type_id": string,"p_name": string,"p_status": string }; Returns: undefined
                           },
"update_roster_character":
{ Args: { "p_character_id": string,"p_class_name": string,"p_gear_score": number,"p_gender": string,"p_guild_position": string,"p_ign": string,"p_level": number,"p_online_status": string,"p_title": string,"p_total_contribution": number,"p_weekly_activity": number,"p_weekly_contribution": number }; Returns: undefined
                           },
"update_roster_custom_field":
{ Args: { "p_field_id": string,"p_name": string,"p_select_options"?: (string)[] }; Returns: undefined
                           },
"validate_event_template":
{ Args: { "p_template_id": string }; Returns: {
              "entity_id": string,"entity_type": string,"issue_code": string,"message": string,"severity": string
            }[]
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
