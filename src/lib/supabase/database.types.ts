
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "channel_members": {
                  Row: {
                    "channel_id": string,"joined_at": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"joined_at"?: string | null,"role"?: string,"user_id": string
                  }
                  Update: {
                    "channel_id"?: string,"joined_at"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_members_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channel_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"channels": {
                  Row: {
                    "created_at": string | null,"created_by": string | null,"description": string | null,"id": string,"is_demo": boolean,"is_private": boolean,"mode": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_demo"?: boolean,"is_private"?: boolean,"mode"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_demo"?: boolean,"is_private"?: boolean,"mode"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channels_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_members": {
                  Row: {
                    "conversation_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_members_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"direct_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"sender_id"?: string | null
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "direct_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dm_pairs": {
                  Row: {
                    "conversation_id": string,"user_high": string,"user_low": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"user_high": string,"user_low": string
                  }
                  Update: {
                    "conversation_id"?: string,"user_high"?: string,"user_low"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dm_pairs_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: true
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dm_pairs_user_high_fkey"
      columns: ["user_high"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dm_pairs_user_low_fkey"
      columns: ["user_low"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "channel_id": string,"content": string,"created_at": string,"id": string,"sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"content": string,"created_at"?: string,"id"?: string,"sender_id"?: string | null
                  }
                  Update: {
                    "channel_id"?: string,"content"?: string,"created_at"?: string,"id"?: string,"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pins": {
                  Row: {
                    "channel_id": string | null,"created_at": string | null,"id": string,"message_id": string | null,"pinned_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id"?: string | null,"created_at"?: string | null,"id"?: string,"message_id"?: string | null,"pinned_by"?: string | null
                  }
                  Update: {
                    "channel_id"?: string | null,"created_at"?: string | null,"id"?: string,"message_id"?: string | null,"pinned_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pins_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pins_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pins_pinned_by_fkey"
      columns: ["pinned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"badges": (string)[] | null,"banner_url": string | null,"bio": string | null,"created_at": string | null,"display_name": string | null,"email": string | null,"id": string,"status": string | null,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"badges"?: (string)[] | null,"banner_url"?: string | null,"bio"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"email"?: string | null,"id": string,"status"?: string | null,"username"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"badges"?: (string)[] | null,"banner_url"?: string | null,"bio"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"email"?: string | null,"id"?: string,"status"?: string | null,"username"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string | null,"emoji": string,"id": string,"message_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"emoji": string,"id"?: string,"message_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"emoji"?: string,"id"?: string,"message_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rooms": {
                  Row: {
                    "active": boolean | null,"channel_id": string | null,"id": string,"livekit_room_name": string,"started_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean | null,"channel_id"?: string | null,"id"?: string,"livekit_room_name": string,"started_at"?: string | null
                  }
                  Update: {
                    "active"?: boolean | null,"channel_id"?: string | null,"id"?: string,"livekit_room_name"?: string,"started_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_channel":
{ Args: { "p_description"?: string,"p_mode"?: string,"p_name": string,"p_private"?: boolean }; Returns: {
              "created_at": string | null,
"created_by": string | null,
"description": string | null,
"id": string,
"is_demo": boolean,
"is_private": boolean,
"mode": string,
"name": string
            }
                          SetofOptions: {
        from: "*"
        to: "channels"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_my_channel_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"get_or_create_dm":
{ Args: { "p_other": string }; Returns: string
                           },
"join_channel":
{ Args: { "p_channel": string }; Returns: undefined
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
  "public": {
          Enums: {
            
          }
        }
} as const
