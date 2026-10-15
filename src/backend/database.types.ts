export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ohmi_assignment_steps: {
        Row: {
          assignment_id: string
          completed: boolean
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          completed?: boolean
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ohmi_assignment_steps_assignment_id_user_id_fkey"
            columns: ["assignment_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ohmi_assignments"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      ohmi_assignments: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          object_path: string
          original_name: string
          size_bytes: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          object_path: string
          original_name: string
          size_bytes: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          object_path?: string
          original_name?: string
          size_bytes?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ohmi_profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          language: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          language?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          language?: string
        }
        Relationships: []
      }
      ohmi_analyses: {
        Row: {
          id: string
          user_id: string
          assignment_id: string | null
          language: string
          payload: Json
          model: string
          created_at: string
          schema_version: number
          artifact_kind: 'analysis' | 'tutorial'
          provider: string
          source_hash: string | null
          prompt_version: number
          fingerprint: string | null
          title: string | null
        }
        Insert: {
          id?: string
          user_id: string
          assignment_id?: string | null
          language: string
          payload: Json
          model: string
          created_at?: string
          schema_version?: number
          artifact_kind?: 'analysis' | 'tutorial'
          provider?: string
          source_hash?: string | null
          prompt_version?: number
          fingerprint?: string | null
          title?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          assignment_id?: string | null
          language?: string
          payload?: Json
          model?: string
          created_at?: string
          schema_version?: number
          artifact_kind?: 'analysis' | 'tutorial'
          provider?: string
          source_hash?: string | null
          prompt_version?: number
          fingerprint?: string | null
          title?: string | null
        }
        Relationships: []
      }
      ohmi_conversations: {
        Row: {
          id: string
          user_id: string
          analysis_id: string | null
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          analysis_id?: string | null
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          analysis_id?: string | null
          title?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ohmi_messages: {
        Row: {
          id: string
          user_id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          position: number
          request_id: string
          created_at: string
          structured_result: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          position: number
          request_id: string
          created_at?: string
          structured_result?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string
          role?: 'user' | 'assistant'
          content?: string
          position?: number
          request_id?: string
          created_at?: string
          structured_result?: Json | null
        }
        Relationships: []
      }
      ohmi_tutorial_progress: {
        Row: {
          analysis_id: string
          user_id: string
          current_step: number
          completed: number[]
          updated_at: string
        }
        Insert: {
          analysis_id: string
          user_id: string
          current_step?: number
          completed?: number[]
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          user_id?: string
          current_step?: number
          completed?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      ohmi_ai_requests: {
        Row: {
          id: string
          user_id: string | null
          kind: string
          input_hash: string
          conversation_id: string | null
          assignment_id: string | null
          language: string
          model: string
          status: 'pending' | 'completed' | 'failed'
          result_id: string | null
          reserved_tokens: number
          input_tokens: number | null
          output_tokens: number | null
          accounted_tokens: number | null
          error_code: string | null
          error_message: string | null
          created_at: string
          finished_at: string | null
        }
        Insert: {
          id: string
          user_id?: string | null
          kind: string
          input_hash: string
          conversation_id?: string | null
          assignment_id?: string | null
          language: string
          model?: string
          status?: 'pending' | 'completed' | 'failed'
          result_id?: string | null
          reserved_tokens: number
          input_tokens?: number | null
          output_tokens?: number | null
          accounted_tokens?: number | null
          error_code?: string | null
          error_message?: string | null
          created_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          kind?: string
          input_hash?: string
          conversation_id?: string | null
          assignment_id?: string | null
          language?: string
          model?: string
          status?: 'pending' | 'completed' | 'failed'
          result_id?: string | null
          reserved_tokens?: number
          input_tokens?: number | null
          output_tokens?: number | null
          accounted_tokens?: number | null
          error_code?: string | null
          error_message?: string | null
          created_at?: string
          finished_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ohmi_save_tutorial_progress: {
        Args: {
          p_analysis_id: string
          p_current_step: number
          p_completed: number[]
        }
        Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
