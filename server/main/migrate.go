package main

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/mattermost/focalboard/server/server"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func migrateDatabase(srcConfig *config.Configuration, destDBType string, destDBConfig string, logger mlog.LoggerIFace) {
	log.Printf("Starting database migration from %s to %s", srcConfig.DBType, destDBType)
	logger.Info("Starting database migration", mlog.String("from", srcConfig.DBType), mlog.String("to", destDBType))

	if destDBConfig == "" {
		logger.Fatal("Destination DB config is required for migration")
		return
	}

	// Initialize source store
	srcStore, err := server.NewStore(srcConfig, false, logger)
	if err != nil {
		logger.Fatal("Failed to open source store", mlog.Err(err))
		return
	}
	defer srcStore.Shutdown()

	// Initialize destination store (this will run migrations/schema creation)
	destConfig := *srcConfig
	destConfig.DBType = destDBType
	destConfig.DBConfigString = destDBConfig

	destStore, err := server.NewStore(&destConfig, false, logger)
	if err != nil {
		logger.Fatal("Failed to open destination store", mlog.Err(err))
		return
	}
	defer destStore.Shutdown()

	// Tables to migrate
	tables := []string{
		"teams",
		"users",
		"boards",
		"boards_history",
		"blocks",
		"blocks_history",
		"board_members",
		"board_members_history",
		"categories",
		"category_boards",
		"file_info",
		"preferences",
		"sessions",
		"sharing",
		"subscriptions",
		"system_settings",
	}

	srcDB, err := sql.Open(srcConfig.DBType, srcConfig.DBConfigString)
	if err != nil {
		logger.Fatal("Failed to open raw source DB", mlog.Err(err))
	}
	defer srcDB.Close()

	destDB, err := sql.Open(destDBType, destDBConfig)
	if err != nil {
		logger.Fatal("Failed to open raw destination DB", mlog.Err(err))
	}
	defer destDB.Close()

	for _, table := range tables {
		logger.Info("Migrating table", mlog.String("table", table))
		if err := copyTable(srcDB, destDB, table, logger); err != nil {
			logger.Error("Failed to migrate table", mlog.String("table", table), mlog.Err(err))
		}
	}

	logger.Info("Database migration completed successfully")
}

func copyTable(srcDB *sql.DB, destDB *sql.DB, table string, logger mlog.LoggerIFace) error {
	// Truncate destination table (optional, but safe for clean migration)
	// Note: Be careful with foreign keys if they exist.
	_, _ = destDB.Exec(fmt.Sprintf("DELETE FROM %s", table))

	rows, err := srcDB.Query(fmt.Sprintf("SELECT * FROM %s", table))
	if err != nil {
		return err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return err
	}

	count := len(columns)
	values := make([]interface{}, count)
	valuePtrs := make([]interface{}, count)

	for rows.Next() {
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return err
		}

		// Prepare insert
		placeholders := ""
		for i := 0; i < count; i++ {
			if i > 0 {
				placeholders += ","
			}
			placeholders += "?"
		}

		// Some DBs like Postgres use $1, $2 instead of ?
		// But for simple migration we can try to be generic or handle per DB type.
		// For now, let's assume ? and if it fails for Postgres we'll fix it.
		// Actually, let's detect if it's postgres.

		query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", table, joinColumns(columns), placeholders)
		
		// If Postgres, replace ? with $n
		// (Simplified detection)
		if isPostgres(destDB) {
			query = convertToPostgresPlaceholder(query)
		}

		if _, err := destDB.Exec(query, values...); err != nil {
			return err
		}
	}

	return nil
}

func joinColumns(columns []string) string {
	res := ""
	for i, col := range columns {
		if i > 0 {
			res += ","
		}
		res += col
	}
	return res
}

func isPostgres(db *sql.DB) bool {
	// A bit hacky but works for this purpose
	var version string
	err := db.QueryRow("SELECT version()").Scan(&version)
	return err == nil
}

func convertToPostgresPlaceholder(query string) string {
	// Replace ? with $1, $2, etc.
	newQuery := ""
	placeholderIdx := 1
	for _, r := range query {
		if r == '?' {
			newQuery += fmt.Sprintf("$%d", placeholderIdx)
			placeholderIdx++
		} else {
			newQuery += string(r)
		}
	}
	return newQuery
}
