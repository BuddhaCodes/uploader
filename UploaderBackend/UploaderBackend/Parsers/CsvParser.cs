using System.Text;

namespace UploaderBackend.Parsers
{
    public static class CsvParser
    {
        public static string[] Parse(string line)
        {
            var fields = new List<string>();
            var current = new StringBuilder();
            bool insideQuotes = false;
            int i = 0;

            while (i < line.Length)
            {
                char c = line[i];

                if (insideQuotes)
                {
                    if (c == '"')
                    {
                        if (i + 1 < line.Length && line[i + 1] == '"')
                        {
                            current.Append('"');
                            i += 2;
                            continue;
                        }
                        insideQuotes = false;
                        i++;
                        continue;
                    }
                    current.Append(c);
                    i++;
                }
                else
                {
                    if (c == '"')
                    {
                        insideQuotes = true;
                        i++;
                    }
                    else if (c == '|')
                    {
                        fields.Add(current.ToString());
                        current.Clear();
                        i++;
                    }
                    else
                    {
                        current.Append(c);
                        i++;
                    }
                }
            }

            fields.Add(current.ToString());
            return fields.ToArray();
        }
    }

}
