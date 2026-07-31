using MySqlConnector;
using System.Text;

namespace UploaderBackend.Database
{
    public static class BatchInserter
    {
        public static async Task InsertAsync(
            string connectionString,
            string tableName,
            string[] columns,
            List<string[]> rows,
            CancellationToken ct)
        {
            if (rows.Count == 0)
                return;

            var safeTable = MySqlTableBuilder.Sanitize(tableName);
            var columnNames = new string[columns.Length];
            for (int c = 0; c < columns.Length; c++)
                columnNames[c] = SanitizeColumnName(columns[c], c);

            var sql = new StringBuilder();
            sql.Append($"INSERT INTO `{safeTable}` (");
            sql.Append(string.Join(", ", System.Array.ConvertAll(columnNames, n => $"`{n}`")));
            sql.Append(") VALUES ");

            using var conn = new MySqlConnection(connectionString);
            await conn.OpenAsync(ct);
            using var cmd = conn.CreateCommand();

            var valueGroups = new List<string>();
            for (int r = 0; r < rows.Count; r++)
            {
                var placeholders = new string[columns.Length];
                for (int c = 0; c < columns.Length; c++)
                {
                    var paramName = $"@p{r}_{c}";
                    placeholders[c] = paramName;

                    var value = c < rows[r].Length ? rows[r][c] : null;
                    cmd.Parameters.AddWithValue(paramName, string.IsNullOrEmpty(value) ? System.DBNull.Value : value);
                }
                valueGroups.Add("(" + string.Join(", ", placeholders) + ")");
            }

            sql.Append(string.Join(", ", valueGroups));
            cmd.CommandText = sql.ToString();

            await cmd.ExecuteNonQueryAsync(ct);
        }

        private static string SanitizeColumnName(string rawName, int index)
        {
            var cleaned = new StringBuilder();
            foreach (var ch in rawName.Trim())
            {
                if (char.IsLetterOrDigit(ch) || ch == '_')
                    cleaned.Append(ch);
                else
                    cleaned.Append('_');
            }
            var result = cleaned.Length == 0 ? $"col_{index}" : cleaned.ToString();
            if (char.IsDigit(result[0]))
                result = "c_" + result;
            return result.ToLowerInvariant();
        }
    }
}
