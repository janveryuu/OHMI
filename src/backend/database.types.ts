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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ohmi_ai_requests: {
        Row: {
          accounted_tokens: number | null
          assignment_id: string | null
          conversation_id: string | null
          created_at: string
          finished_at: string | null
          id: string
          input_hash: string
          input_tokens: number | null
          kind: string
          language: string
          model: string
          output_tokens: number | null
          reserved_tokens: number
          result_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          accounted_tokens?: number | null
          assignment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          finished_at?: string | null
          id: string
          input_hash: string
          input_tokens?: number | null
          kind: string
          language: string
          model?: string
          output_tokens?: number | null
          reserved_tokens: number
          result_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          accounted_tokens?: number | null
          assignment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          input_hash?: string
          input_tokens?: number | null
          kind?: string
          language?: string
          model?: string
          output_tokens?: number | null
          reserved_tokens?: number
          result_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ohmi_ai_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "ohmi_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ohmi_ai_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ohmi_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ohmi_analyses: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          language: string
          model: string
          payload: Json
          user_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          language: string
          model: string
          payload: Json
          user_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          language?: string
          model?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ohmi_analyses_assignment_id_user_id_fkey"
            columns: ["assignment_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ohmi_assignments"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
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
      ohmi_conversations: {
        Row: {
          analysis_id: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ohmi_conversations_analysis_id_user_id_fkey"
            columns: ["analysis_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ohmi_analyses"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      ohmi_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          position: number
          request_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          position: number
          request_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          position?: number
          request_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ohmi_messages_conversation_id_user_id_fkey"
            columns: ["conversation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ohmi_conversations"
            referencedColumns: ["id", "user_id"]
          },
        ]
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
      ohmi_tutorial_progress: {
        Row: {
          analysis_id: string
          completed: number[]
          current_step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_id: string
          completed?: number[]
          current_step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_id?: string
          completed?: number[]
          current_step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ohmi_tutorial_progress_analysis_id_user_id_fkey"
            columns: ["analysis_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ohmi_analyses"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ohmi_complete_ai: {
        Args: {
          p_accounted_tokens?: number
          p_input_tokens: number
          p_model?: string
          p_output: Json
          p_output_tokens: number
          p_request_id: string
        }
        Returns: Json
      }
      ohmi_reserve_ai: {
        Args: {
          p_hash: string
          p_kind: string
          p_language: string
          p_estimated_tokens?: number
          p_request_id: string
          p_target: string
          p_user_id: string
        }
        Returns: Json
      }
      ohmi_save_tutorial_progress: {
        Args: {
          p_analysis_id: string
          p_completed: number[]
          p_current_step: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
