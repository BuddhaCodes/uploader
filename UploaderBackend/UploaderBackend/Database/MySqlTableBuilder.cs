using MySqlConnector;
using System.Text;
using System.Text.RegularExpressions;

namespace UploaderBackend.Database
{
    public static class MySqlTableBuilder
    {
        public static async Task CreateTableAsync(
            string connectionString,
            string tableName,
            string[] headerColumns,
            CancellationToken ct)
        {
            var safeTableName = Sanitize(tableName);
            var columnDefs = headerColumns
                .Select((col, idx) => $"`{SanitizeColumn(col, idx)}` VARCHAR(500) NULL")
                .ToArray();

            var sql = new StringBuilder();
            sql.Append($"CREATE TABLE IF NOT EXISTS `{safeTableName}` (");
            sql.Append("`id` BIGINT AUTO_INCREMENT PRIMARY KEY, ");
            sql.Append(string.Join(", ", columnDefs));
            sql.Append(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

            using var conn = new MySqlConnection(connectionString);
            await conn.OpenAsync(ct);
            using var cmd = new MySqlCommand(sql.ToString(), conn);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        public static string Sanitize(string name)
        {
            var cleaned = Regex.Replace(name, "[^a-zA-Z0-9_]", "_");
            if (cleaned.Length == 0 || char.IsDigit(cleaned[0]))
                cleaned = "t_" + cleaned;
            return cleaned.ToLowerInvariant();
        }

        private static string SanitizeColumn(string rawName, int index)
        {
            var cleaned = Regex.Replace(rawName.Trim(), "[^a-zA-Z0-9_]", "_");
            if (cleaned.Length == 0)
                cleaned = $"col_{index}";
            if (char.IsDigit(cleaned[0]))
                cleaned = "c_" + cleaned;
            return cleaned.ToLowerInvariant();
        }
    }
}
