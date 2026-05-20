from neo4j import GraphDatabase
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.core.config import settings

def _run_cypher_file(driver, filepath, label, strip_comments=False):
    with open(filepath, "r") as f:
        cypher_content = f.read()

    with driver.session() as session:
        commands = [cmd.strip() for cmd in cypher_content.split(";")]
        count = 0
        for i, command in enumerate(commands):
            if not command:
                continue
            if strip_comments:
                lines = [line for line in command.split('\n')
                         if line.strip() and not line.strip().startswith('//')]
                command = '\n'.join(lines)
            elif command.startswith("//"):
                continue
            if not command:
                continue
            try:
                session.run(command)
                count += 1
                if count % 50 == 0:
                    print(f"  {label}: processed {count} commands...")
            except Exception as e:
                print(f"  {label}: warning — command {i} failed: {str(e)[:100]}")

    print(f"  {label}: done ({count} commands)")

def init_neo4j(uri, password, cypher_files):

    try:

        driver = GraphDatabase.driver(uri, auth=("neo4j", password))

        for filepath in cypher_files:
            if os.path.exists(filepath):
                label = os.path.basename(filepath)
                _run_cypher_file(driver, filepath, label, strip_comments=True)
            else:
                print(f"  Skipping {filepath} (not found)")

        driver.close()
        return True

    except Exception as e:
        print(f"ERROR: Neo4j initialization failed: {e}")
        return False

if __name__ == "__main__":

    uri = settings.neo4j_url
    password = settings.neo4j_password

    if len(sys.argv) > 1:
        cypher_files = sys.argv[1:]
    else:
        cypher_files = [
            "/init/init_neo4j_ddl.cypher",
            "/init/init_neo4j_taxonomy.cypher",
        ]

    success = init_neo4j(uri, password, cypher_files)
    sys.exit(0 if success else 1)
