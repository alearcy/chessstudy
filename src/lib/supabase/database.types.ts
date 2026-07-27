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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      boards: {
        Row: {
          arrows: Json
          black_name: string | null
          board_order: number
          created_at: string
          eval_best_move_uci: string | null
          eval_cp: number | null
          eval_depth: number
          eval_mate: number | null
          fen: string
          game_analysis: string | null
          headers: Json
          highlights: Json
          id: number
          lesson_id: number
          notes: string
          opening_eco: string | null
          opening_family: string | null
          opening_name: string | null
          opening_report: Json | null
          title: string
          uid: string
          updated_at: string
          user_id: string
          white_name: string | null
        }
        Insert: {
          arrows?: Json
          black_name?: string | null
          board_order?: number
          created_at?: string
          eval_best_move_uci?: string | null
          eval_cp?: number | null
          eval_depth?: number
          eval_mate?: number | null
          fen: string
          game_analysis?: string | null
          headers?: Json
          highlights?: Json
          id?: number
          lesson_id: number
          notes?: string
          opening_eco?: string | null
          opening_family?: string | null
          opening_name?: string | null
          opening_report?: Json | null
          title: string
          uid?: string
          updated_at?: string
          user_id?: string
          white_name?: string | null
        }
        Update: {
          arrows?: Json
          black_name?: string | null
          board_order?: number
          created_at?: string
          eval_best_move_uci?: string | null
          eval_cp?: number | null
          eval_depth?: number
          eval_mate?: number | null
          fen?: string
          game_analysis?: string | null
          headers?: Json
          highlights?: Json
          id?: number
          lesson_id?: number
          notes?: string
          opening_eco?: string | null
          opening_family?: string | null
          opening_name?: string | null
          opening_report?: Json | null
          title?: string
          uid?: string
          updated_at?: string
          user_id?: string
          white_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boards_lesson_owner_fkey"
            columns: ["lesson_id", "user_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          description: string
          id: number
          is_favorite: boolean
          mode: string
          search_text: string
          title: string
          uid: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: number
          is_favorite?: boolean
          mode?: string
          search_text?: string
          title: string
          uid?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: number
          is_favorite?: boolean
          mode?: string
          search_text?: string
          title?: string
          uid?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      moves: {
        Row: {
          analysis_comment: string | null
          arrows: Json
          board_id: number
          comment: string
          created_at: string
          eval_best_move_uci: string | null
          eval_cp: number | null
          eval_depth: number
          eval_mate: number | null
          fen: string
          highlights: Json
          id: number
          move_notation: string
          move_order: number
          parent_id: number | null
          stockfish_comment: string | null
          tactics: Json
          uid: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_comment?: string | null
          arrows?: Json
          board_id: number
          comment?: string
          created_at?: string
          eval_best_move_uci?: string | null
          eval_cp?: number | null
          eval_depth?: number
          eval_mate?: number | null
          fen: string
          highlights?: Json
          id?: number
          move_notation: string
          move_order: number
          parent_id?: number | null
          stockfish_comment?: string | null
          tactics?: Json
          uid?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          analysis_comment?: string | null
          arrows?: Json
          board_id?: number
          comment?: string
          created_at?: string
          eval_best_move_uci?: string | null
          eval_cp?: number | null
          eval_depth?: number
          eval_mate?: number | null
          fen?: string
          highlights?: Json
          id?: number
          move_notation?: string
          move_order?: number
          parent_id?: number | null
          stockfish_comment?: string | null
          tactics?: Json
          uid?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moves_board_owner_fkey"
            columns: ["board_id", "user_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "moves_parent_board_owner_fkey"
            columns: ["parent_id", "board_id", "user_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id", "board_id", "user_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          chesscom_username: string
          created_at: string
          lichess_username: string
          stockfish_depth: number
          stockfish_threads: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chesscom_username?: string
          created_at?: string
          lichess_username?: string
          stockfish_depth?: number
          stockfish_threads?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          chesscom_username?: string
          created_at?: string
          lichess_username?: string
          stockfish_depth?: number
          stockfish_threads?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_security_state: {
        Row: {
          created_at: string
          must_change_password: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          must_change_password?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          must_change_password?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_analysis_to_study: {
        Args: { p_source_board_id: number; p_source_lesson_id: number }
        Returns: number
      }
      duplicate_study_board: {
        Args: { p_source_board_id: number }
        Returns: number
      }
      reorder_study_boards: {
        Args: { p_board_ids: number[]; p_lesson_id: number }
        Returns: undefined
      }
      import_database_backup_v1: { Args: { p_backup: Json }; Returns: Json }
      save_board_line: {
        Args: {
          p_board: Json
          p_board_id: number | null
          p_lesson_id: number
          p_moves: Json
        }
        Returns: Json
      }
      save_lesson_tree: {
        Args: {
          p_board: Json
          p_lesson: Json
          p_lesson_id: number | null
          p_moves: Json
          p_replace: boolean
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
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
